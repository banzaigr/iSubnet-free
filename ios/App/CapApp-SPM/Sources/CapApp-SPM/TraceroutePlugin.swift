import Foundation
import UIKit
import Capacitor
import Darwin

private enum TracePacketKind {
    case reply
    case timeExceeded
    case unreachable
}

private struct TracePacketMatch {
    let kind: TracePacketKind
    let seq: Int
    let address: String
}

private func parseTracePacket(buf: [UInt8], length: Int, seqMin: Int, seqMax: Int, fallbackSender: String) -> TracePacketMatch? {
    guard length >= 20, buf.count >= length else { return nil }
    guard (buf[0] >> 4) == 4 else { return nil }
    let outerIhl = Int(buf[0] & 0x0F) * 4
    guard outerIhl >= 20, length >= outerIhl + 8 else { return nil }

    let senderIp: String
    if !fallbackSender.isEmpty {
        senderIp = fallbackSender
    } else {
        senderIp = "\(buf[12]).\(buf[13]).\(buf[14]).\(buf[15])"
    }

    let icmpOffset = outerIhl
    let icmpType = buf[icmpOffset]

    if icmpType == 0 {
        let seq = (Int(buf[icmpOffset + 6]) << 8) | Int(buf[icmpOffset + 7])
        if seq >= seqMin && seq <= seqMax {
            return TracePacketMatch(kind: .reply, seq: seq, address: senderIp)
        }
        return nil
    } else if icmpType == 11 || icmpType == 3 {
        let innerIpOffset = icmpOffset + 8
        guard length >= innerIpOffset + 20 else { return nil }
        guard (buf[innerIpOffset] >> 4) == 4 else { return nil }
        let innerIhl = Int(buf[innerIpOffset] & 0x0F) * 4
        let innerIcmpOffset = innerIpOffset + innerIhl
        guard innerIhl >= 20, length >= innerIcmpOffset + 8 else { return nil }
        guard buf[innerIpOffset + 9] == UInt8(IPPROTO_ICMP) else { return nil }
        guard buf[innerIcmpOffset] == 8 else { return nil }

        let innerSeq = (Int(buf[innerIcmpOffset + 6]) << 8) | Int(buf[innerIcmpOffset + 7])
        guard innerSeq >= seqMin && innerSeq <= seqMax else { return nil }

        let kind: TracePacketKind = (icmpType == 11) ? .timeExceeded : .unreachable
        return TracePacketMatch(kind: kind, seq: innerSeq, address: senderIp)
    }

    return nil
}

private func describeSocketErrno(_ err: Int32) -> String {
    let raw = String(cString: strerror(err))
    if err == EPERM || err == EACCES {
        return "Traceroute is not permitted on this device (\(raw))"
    }
    if err == ENETUNREACH {
        return "Network is unreachable (\(raw))"
    }
    if err == EHOSTUNREACH {
        return "No route to host (\(raw))"
    }
    if err == ENETDOWN {
        return "Network is down (\(raw))"
    }
    return "Traceroute socket error (\(err)): \(raw)"
}

@objc(TraceroutePlugin)
public class TraceroutePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TraceroutePlugin"
    public let jsName = "Traceroute"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "trace", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]

    private let stateLock = NSLock()
    private var isRunning = false
    private var isCancelled = false
    private var activeRunId: Int = 0
    private let traceQueue = DispatchQueue(label: "com.banzaigr.isubnet.traceroute", qos: .userInitiated)
    private let dnsQueue = DispatchQueue(label: "com.banzaigr.isubnet.traceroute.dns", qos: .utility, attributes: .concurrent)
    private var backgroundObserver: NSObjectProtocol?

    public func cancelIfRunning() {
        stateLock.lock()
        if isRunning {
            isCancelled = true
        }
        stateLock.unlock()
    }

    public func observeAppBackground() {
        if backgroundObserver != nil { return }
        backgroundObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.didEnterBackgroundNotification,
            object: nil,
            queue: nil
        ) { [weak self] _ in
            self?.cancelIfRunning()
        }
    }

    deinit {
        if let o = backgroundObserver {
            NotificationCenter.default.removeObserver(o)
        }
    }

    private func checkCancelled() -> Bool {
        stateLock.lock()
        let c = isCancelled
        stateLock.unlock()
        return c
    }

    private func isRunStillCurrent(_ runId: Int) -> Bool {
        stateLock.lock()
        let ok = (activeRunId == runId)
        stateLock.unlock()
        return ok
    }

    private func getAndClearState() -> Bool {
        stateLock.lock()
        let wasCancelled = isCancelled
        isRunning = false
        isCancelled = false
        stateLock.unlock()
        return wasCancelled
    }

    private func emitHopEvent(ttl: Int, probe: Int, outcome: String, address: String?, timeMs: Double?) {
        let addrVal: Any = address ?? NSNull()
        let timeVal: Any = timeMs ?? NSNull()
        notifyListeners("hop", data: [
            "ttl": ttl,
            "probe": probe,
            "outcome": outcome,
            "address": addrVal,
            "timeMs": timeVal
        ])
    }

    private func scheduleReverseDns(address: String, runId: Int) {
        dnsQueue.async { [weak self] in
            guard let self = self, self.isRunStillCurrent(runId) else { return }
            var sin = sockaddr_in()
            memset(&sin, 0, MemoryLayout<sockaddr_in>.size)
            sin.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
            sin.sin_family = sa_family_t(AF_INET)
            guard inet_pton(AF_INET, address, &sin.sin_addr) == 1 else { return }

            var hostBuffer = [CChar](repeating: 0, count: Int(NI_MAXHOST))
            let gniStatus = withUnsafePointer(to: &sin) { ptr in
                ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { saPtr in
                    getnameinfo(
                        saPtr,
                        socklen_t(MemoryLayout<sockaddr_in>.size),
                        &hostBuffer,
                        socklen_t(hostBuffer.count),
                        nil,
                        0,
                        NI_NAMEREQD
                    )
                }
            }
            guard gniStatus == 0 else { return }
            var name = String(cString: hostBuffer).trimmingCharacters(in: .whitespacesAndNewlines)
            while name.hasSuffix(".") {
                name.removeLast()
            }
            guard !name.isEmpty, name != address, self.isRunStillCurrent(runId) else { return }
            self.notifyListeners("hostname", data: [
                "address": address,
                "hostname": name
            ])
        }
    }

    @objc public func trace(_ call: CAPPluginCall) {
        guard let rawHost = call.getString("host") else {
            call.reject("Invalid host")
            return
        }
        let host = rawHost.trimmingCharacters(in: .whitespacesAndNewlines)
        guard isValidHost(host) else {
            call.reject("Invalid host")
            return
        }
        if host.contains(":") {
            call.reject("IPv6 traceroute is not supported yet")
            return
        }

        let maxHops = min(max(call.getInt("maxHops") ?? 30, 1), 64)
        let probes = min(max(call.getInt("probes") ?? 3, 1), 5)
        let timeoutMs = min(max(call.getInt("timeoutMs") ?? 2000, 500), 5000)
        let resolveNames = call.getBool("resolveNames") ?? false

        stateLock.lock()
        if isRunning {
            stateLock.unlock()
            call.reject("Traceroute already running")
            return
        }
        isRunning = true
        isCancelled = false
        activeRunId &+= 1
        let runId = activeRunId
        stateLock.unlock()

        traceQueue.async { [weak self] in
            guard let self = self else { return }

            var hints = addrinfo()
            memset(&hints, 0, MemoryLayout<addrinfo>.size)
            hints.ai_family = AF_INET
            hints.ai_socktype = SOCK_DGRAM

            var res: UnsafeMutablePointer<addrinfo>? = nil
            let gaiStatus = getaddrinfo(host, nil, &hints, &res)
            if gaiStatus != 0 || res == nil {
                _ = self.getAndClearState()
                call.reject("Unknown host")
                return
            }

            var selectedAddrLen: socklen_t = 0
            var selectedStorage = sockaddr_storage()
            var resolvedAddressStr = ""
            var foundNode = false

            var curr = res
            while let node = curr {
                if node.pointee.ai_family == AF_INET, let aiAddr = node.pointee.ai_addr {
                    selectedAddrLen = node.pointee.ai_addrlen
                    memcpy(&selectedStorage, aiAddr, Int(node.pointee.ai_addrlen))
                    foundNode = true
                    break
                }
                curr = node.pointee.ai_next
            }
            freeaddrinfo(res)

            if foundNode {
                var hostBuffer = [CChar](repeating: 0, count: Int(NI_MAXHOST))
                let gniStatus = withUnsafePointer(to: &selectedStorage) { ptr in
                    ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { saPtr in
                        getnameinfo(saPtr, selectedAddrLen, &hostBuffer, socklen_t(hostBuffer.count), nil, 0, NI_NUMERICHOST)
                    }
                }
                if gniStatus == 0 {
                    resolvedAddressStr = String(cString: hostBuffer)
                }
            }

            if !foundNode || resolvedAddressStr.isEmpty {
                _ = self.getAndClearState()
                call.reject("Unknown host")
                return
            }

            if self.checkCancelled() {
                let wasCancelled = self.getAndClearState()
                call.resolve([
                    "host": host,
                    "resolvedAddress": resolvedAddressStr,
                    "hops": 0,
                    "reached": false,
                    "unreachable": false,
                    "cancelled": wasCancelled
                ])
                return
            }

            let sock = socket(AF_INET, SOCK_DGRAM, IPPROTO_ICMP)
            if sock < 0 {
                let err = errno
                _ = self.getAndClearState()
                call.reject(describeSocketErrno(err))
                return
            }
            defer {
                close(sock)
            }

            let flags = fcntl(sock, F_GETFL, 0)
            if flags >= 0 {
                _ = fcntl(sock, F_SETFL, flags | O_NONBLOCK)
            } else {
                _ = fcntl(sock, F_SETFL, O_NONBLOCK)
            }

            self.notifyListeners("resolved", data: [
                "address": resolvedAddressStr
            ])

            var seenAddresses = Set<String>()
            var lastTtlProbed = 0
            var reached = false
            var unreachable = false
            var fatalErrorMessage: String? = nil
            var seqBase = 0
            var recvBuf = [UInt8](repeating: 0, count: 1500)

            for ttl in 1...maxHops {
                if self.checkCancelled() {
                    break
                }
                lastTtlProbed = ttl

                /* Drain any late packets from earlier hops before sending probe 1 of this hop. */
                while recv(sock, &recvBuf, recvBuf.count, 0) > 0 {}

                var ttlVal = Int32(ttl)
                let ttlStatus = setsockopt(sock, IPPROTO_IP, IP_TTL, &ttlVal, socklen_t(MemoryLayout<Int32>.size))
                if ttlStatus < 0 {
                    fatalErrorMessage = describeSocketErrno(errno)
                    break
                }

                let firstSeq = seqBase + 1
                let lastSeq = seqBase + probes
                var sentNs = [UInt64](repeating: 0, count: probes + 1)
                var deadlineNs = [UInt64](repeating: 0, count: probes + 1)
                var done = [Bool](repeating: false, count: probes + 1)
                var pending = 0
                var localSendErrors = 0
                var lastSendErrno: Int32 = 0
                var hopReached = false
                var hopUnreachable = false

                func pollOnce(_ waitMs: Int32) {
                    var pfd = pollfd(fd: sock, events: Int16(POLLIN), revents: 0)
                    let pollRes = poll(&pfd, 1, waitMs)
                    if pollRes <= 0 { return }
                    while true {
                        var fromAddr = sockaddr_storage()
                        var fromLen = socklen_t(MemoryLayout<sockaddr_storage>.size)
                        let bytesRead = withUnsafeMutablePointer(to: &fromAddr) { ptr in
                            ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { saPtr in
                                recvfrom(sock, &recvBuf, recvBuf.count, 0, saPtr, &fromLen)
                            }
                        }
                        if bytesRead <= 0 {
                            break
                        }
                        let endNs = DispatchTime.now().uptimeNanoseconds

                        var senderStr = ""
                        if fromAddr.ss_family == sa_family_t(AF_INET) {
                            var hostBuf = [CChar](repeating: 0, count: Int(NI_MAXHOST))
                            let st = withUnsafePointer(to: &fromAddr) { ptr in
                                ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { saPtr in
                                    getnameinfo(saPtr, fromLen, &hostBuf, socklen_t(hostBuf.count), nil, 0, NI_NUMERICHOST)
                                }
                            }
                            if st == 0 {
                                senderStr = String(cString: hostBuf)
                            }
                        }

                        guard let match = parseTracePacket(
                            buf: recvBuf,
                            length: bytesRead,
                            seqMin: firstSeq,
                            seqMax: lastSeq,
                            fallbackSender: senderStr
                        ) else {
                            continue
                        }
                        let p = match.seq - firstSeq + 1
                        if p < 1 || p > probes || done[p] || sentNs[p] == 0 {
                            continue
                        }
                        done[p] = true
                        pending -= 1

                        let elapsedNs = endNs > sentNs[p] ? (endNs - sentNs[p]) : 0
                        let ms = (Double(elapsedNs) / 1_000_000.0 * 10.0).rounded() / 10.0
                        let outcome: String
                        switch match.kind {
                        case .reply:
                            outcome = "REPLY"
                            hopReached = true
                        case .timeExceeded:
                            outcome = "TIME_EXCEEDED"
                        case .unreachable:
                            outcome = "UNREACHABLE"
                            hopUnreachable = true
                        }

                        self.emitHopEvent(ttl: ttl, probe: p, outcome: outcome, address: match.address, timeMs: ms)
                        if resolveNames && !match.address.isEmpty && !seenAddresses.contains(match.address) {
                            seenAddresses.insert(match.address)
                            self.scheduleReverseDns(address: match.address, runId: runId)
                        }
                    }
                }

                for p in 1...probes {
                    seqBase += 1
                    if self.checkCancelled() {
                        done[p] = true
                        break
                    }

                    let packet = buildPacket(family: AF_INET, seq: seqBase)
                    let startNs = DispatchTime.now().uptimeNanoseconds

                    let bytesSent = withUnsafePointer(to: &selectedStorage) { ptr in
                        ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { saPtr in
                            sendto(sock, packet, packet.count, 0, saPtr, selectedAddrLen)
                        }
                    }

                    if bytesSent < 0 {
                        lastSendErrno = errno
                        done[p] = true
                        localSendErrors += 1
                        self.emitHopEvent(ttl: ttl, probe: p, outcome: "ERROR", address: nil, timeMs: nil)
                        continue
                    }

                    sentNs[p] = startNs
                    deadlineNs[p] = startNs + UInt64(timeoutMs) * 1_000_000
                    pending += 1

                    if p < probes {
                        let gapEndNs = DispatchTime.now().uptimeNanoseconds + 30 * 1_000_000
                        while !self.checkCancelled() {
                            let nowNs = DispatchTime.now().uptimeNanoseconds
                            if nowNs >= gapEndNs { break }
                            let remMs = Int((gapEndNs - nowNs + 999_999) / 1_000_000)
                            pollOnce(Int32(min(max(remMs, 1), 30)))
                        }
                    }
                }

                while pending > 0 && !self.checkCancelled() {
                    pollOnce(25)
                    let nowNs = DispatchTime.now().uptimeNanoseconds
                    for p in 1...probes {
                        if !done[p] && nowNs >= deadlineNs[p] {
                            done[p] = true
                            pending -= 1
                            self.emitHopEvent(ttl: ttl, probe: p, outcome: "TIMEOUT", address: nil, timeMs: nil)
                        }
                    }
                }

                if self.checkCancelled() {
                    break
                }
                if localSendErrors == probes {
                    fatalErrorMessage = describeSocketErrno(lastSendErrno)
                    break
                }
                if hopReached {
                    reached = true
                    break
                }
                if hopUnreachable {
                    unreachable = true
                    break
                }
            }

            let wasCancelled = self.getAndClearState()
            if let errMsg = fatalErrorMessage {
                call.reject(errMsg)
                return
            }
            call.resolve([
                "host": host,
                "resolvedAddress": resolvedAddressStr,
                "hops": lastTtlProbed,
                "reached": reached,
                "unreachable": unreachable,
                "cancelled": wasCancelled
            ])
        }
    }

    @objc public func stop(_ call: CAPPluginCall) {
        cancelIfRunning()
        call.resolve()
    }
}
