import Foundation
import Capacitor
import Darwin

enum PingParseResult {
    case reply(ttl: Int?)
    case unreachable
    case ignore
}

func isValidHost(_ host: String) -> Bool {
    let count = host.utf8.count
    guard count >= 1 && count <= 253 else {
        return false
    }
    guard !host.hasPrefix("-") else {
        return false
    }
    for scalar in host.unicodeScalars {
        let val = scalar.value
        let isLower = val >= 97 && val <= 122   // a-z
        let isUpper = val >= 65 && val <= 90    // A-Z
        let isDigit = val >= 48 && val <= 57    // 0-9
        let isPunct = val == 46 || val == 45 || val == 95 || val == 58 // . - _ :
        if !(isLower || isUpper || isDigit || isPunct) {
            return false
        }
    }
    return true
}

func calculateChecksum(_ bytes: [UInt8]) -> UInt16 {
    var sum: UInt32 = 0
    let count = bytes.count
    var i = 0
    while i < count - 1 {
        let word = (UInt32(bytes[i]) << 8) | UInt32(bytes[i + 1])
        sum &+= word
        i += 2
    }
    if i < count {
        let word = UInt32(bytes[i]) << 8
        sum &+= word
    }
    while (sum >> 16) != 0 {
        sum = (sum & 0xFFFF) &+ (sum >> 16)
    }
    return UInt16(~(sum & 0xFFFF))
}

func buildPacket(family: Int32, seq: Int) -> [UInt8] {
    var packet = [UInt8](repeating: 0, count: 64)
    let randomId = UInt16.random(in: 0...UInt16.max)
    let seq16 = UInt16(seq & 0xFFFF)

    if family == AF_INET {
        packet[0] = 8 // ICMP Echo Request
        packet[1] = 0 // Code
        packet[2] = 0 // Checksum high (0 for calculation)
        packet[3] = 0 // Checksum low
        packet[4] = UInt8((randomId >> 8) & 0xFF)
        packet[5] = UInt8(randomId & 0xFF)
        packet[6] = UInt8((seq16 >> 8) & 0xFF)
        packet[7] = UInt8(seq16 & 0xFF)
        for i in 8..<64 {
            packet[i] = UInt8((i - 8) & 0xFF)
        }
        let checksum = calculateChecksum(packet)
        packet[2] = UInt8((checksum >> 8) & 0xFF)
        packet[3] = UInt8(checksum & 0xFF)
    } else {
        packet[0] = 128 // ICMPv6 Echo Request
        packet[1] = 0   // Code
        packet[2] = 0   // Checksum (kernel computes)
        packet[3] = 0
        packet[4] = UInt8((randomId >> 8) & 0xFF)
        packet[5] = UInt8(randomId & 0xFF)
        packet[6] = UInt8((seq16 >> 8) & 0xFF)
        packet[7] = UInt8(seq16 & 0xFF)
        for i in 8..<64 {
            packet[i] = UInt8((i - 8) & 0xFF)
        }
    }
    return packet
}

func parseReply(family: Int32, buf: [UInt8], length: Int, expectedSeq: Int) -> PingParseResult {
    if family == AF_INET {
        guard length >= 20 else { return .ignore }
        guard (buf[0] >> 4) == 4 else { return .ignore }
        let ipHeaderLen = Int(buf[0] & 0x0F) * 4
        guard ipHeaderLen >= 20, length >= ipHeaderLen + 8 else { return .ignore }
        let ttl = Int(buf[8])
        let icmpOffset = ipHeaderLen
        let icmpType = buf[icmpOffset]
        if icmpType == 0 {
            let seq = (UInt16(buf[icmpOffset + 6]) << 8) | UInt16(buf[icmpOffset + 7])
            if seq == UInt16(expectedSeq & 0xFFFF) {
                return .reply(ttl: ttl)
            } else {
                return .ignore
            }
        } else if icmpType == 3 {
            return .unreachable
        } else {
            return .ignore
        }
    } else {
        guard length >= 8 else { return .ignore }
        let icmpType = buf[0]
        if icmpType == 129 {
            let seq = (UInt16(buf[6]) << 8) | UInt16(buf[7])
            if seq == UInt16(expectedSeq & 0xFFFF) {
                return .reply(ttl: nil)
            } else {
                return .ignore
            }
        } else if icmpType == 1 {
            return .unreachable
        } else {
            return .ignore
        }
    }
}

@objc(PingPlugin)
public class PingPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PingPlugin"
    public let jsName = "Ping"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "ping", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]

    private let stateLock = NSLock()
    private var isRunning = false
    private var isCancelled = false
    private let pingQueue = DispatchQueue(label: "com.banzaigr.isubnet.ping", qos: .userInitiated)

    private func checkCancelled() -> Bool {
        stateLock.lock()
        let c = isCancelled
        stateLock.unlock()
        return c
    }

    private func getAndClearState() -> Bool {
        stateLock.lock()
        let wasCancelled = isCancelled
        isRunning = false
        isCancelled = false
        stateLock.unlock()
        return wasCancelled
    }

    @objc public func ping(_ call: CAPPluginCall) {
        guard let rawHost = call.getString("host") else {
            call.reject("Invalid host")
            return
        }
        let host = rawHost.trimmingCharacters(in: .whitespacesAndNewlines)
        guard isValidHost(host) else {
            call.reject("Invalid host")
            return
        }

        let rawCount = call.getInt("count") ?? 4
        let count = min(max(rawCount, 1), 10)
        let rawTimeout = call.getInt("timeoutMs") ?? 3000
        let timeoutMs = min(max(rawTimeout, 1000), 5000)

        stateLock.lock()
        if isRunning {
            stateLock.unlock()
            call.reject("Ping already running")
            return
        }
        isRunning = true
        isCancelled = false
        stateLock.unlock()

        pingQueue.async { [weak self] in
            guard let self = self else { return }

            var hints = addrinfo()
            memset(&hints, 0, MemoryLayout<addrinfo>.size)
            hints.ai_socktype = SOCK_DGRAM
            if host.contains(":") {
                hints.ai_family = AF_INET6
                hints.ai_flags = AI_NUMERICHOST
            } else {
                hints.ai_family = AF_UNSPEC
            }

            var res: UnsafeMutablePointer<addrinfo>? = nil
            let gaiStatus = getaddrinfo(host, nil, &hints, &res)

            if gaiStatus != 0 || res == nil {
                for seq in 1...count {
                    self.notifyListeners("probe", data: [
                        "seq": seq,
                        "outcome": "UNKNOWN_HOST",
                        "timeMs": NSNull(),
                        "ttl": NSNull(),
                        "resolvedAddress": NSNull(),
                        "message": "Unknown host"
                    ])
                }
                let wasCancelled = self.getAndClearState()
                call.resolve([
                    "host": host,
                    "resolvedAddress": NSNull(),
                    "sent": count,
                    "received": 0,
                    "lossPercent": 100,
                    "minMs": NSNull(),
                    "avgMs": NSNull(),
                    "maxMs": NSNull(),
                    "cancelled": wasCancelled
                ])
                return
            }

            var selectedFamily: Int32 = 0
            var selectedAddrLen: socklen_t = 0
            var selectedStorage = sockaddr_storage()
            var resolvedAddressStr = ""
            var foundNode = false

            var curr = res
            while let node = curr {
                if node.pointee.ai_family == AF_INET {
                    selectedFamily = AF_INET
                    selectedAddrLen = node.pointee.ai_addrlen
                    memcpy(&selectedStorage, node.pointee.ai_addr, Int(node.pointee.ai_addrlen))
                    foundNode = true
                    break
                }
                curr = node.pointee.ai_next
            }

            if !foundNode {
                curr = res
                while let node = curr {
                    if node.pointee.ai_family == AF_INET6 {
                        selectedFamily = AF_INET6
                        selectedAddrLen = node.pointee.ai_addrlen
                        memcpy(&selectedStorage, node.pointee.ai_addr, Int(node.pointee.ai_addrlen))
                        foundNode = true
                        break
                    }
                    curr = node.pointee.ai_next
                }
            }

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
            freeaddrinfo(res)

            if !foundNode {
                for seq in 1...count {
                    self.notifyListeners("probe", data: [
                        "seq": seq,
                        "outcome": "UNKNOWN_HOST",
                        "timeMs": NSNull(),
                        "ttl": NSNull(),
                        "resolvedAddress": NSNull(),
                        "message": "Unknown host"
                    ])
                }
                let wasCancelled = self.getAndClearState()
                call.resolve([
                    "host": host,
                    "resolvedAddress": NSNull(),
                    "sent": count,
                    "received": 0,
                    "lossPercent": 100,
                    "minMs": NSNull(),
                    "avgMs": NSNull(),
                    "maxMs": NSNull(),
                    "cancelled": wasCancelled
                ])
                return
            }

            let protocolNum = (selectedFamily == AF_INET) ? IPPROTO_ICMP : IPPROTO_ICMPV6
            let sock = socket(selectedFamily, SOCK_DGRAM, protocolNum)
            if sock < 0 {
                _ = self.getAndClearState()
                call.reject("Ping is not available on this device")
                return
            }

            defer {
                close(sock)
            }

            _ = fcntl(sock, F_SETFL, O_NONBLOCK)

            var sent = 0
            var received = 0
            var minMs: Double? = nil
            var maxMs: Double? = nil
            var sumMs = 0.0

            for seq in 1...count {
                if self.checkCancelled() {
                    break
                }

                let packet = buildPacket(family: selectedFamily, seq: seq)
                let startNs = DispatchTime.now().uptimeNanoseconds

                let bytesSent = withUnsafePointer(to: &selectedStorage) { ptr in
                    ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { saPtr in
                        sendto(sock, packet, packet.count, 0, saPtr, selectedAddrLen)
                    }
                }

                if bytesSent < 0 {
                    let err = errno
                    let outcome: String
                    let message: String
                    if err == ENETUNREACH || err == EHOSTUNREACH || err == EHOSTDOWN || err == ENETDOWN {
                        outcome = "UNREACHABLE"
                        message = "Destination unreachable"
                    } else {
                        outcome = "ERROR"
                        message = "Ping failed"
                    }
                    sent += 1
                    let addrValue: Any = resolvedAddressStr.isEmpty ? NSNull() : resolvedAddressStr
                    self.notifyListeners("probe", data: [
                        "seq": seq,
                        "outcome": outcome,
                        "timeMs": NSNull(),
                        "ttl": NSNull(),
                        "resolvedAddress": addrValue,
                        "message": message
                    ])

                    if seq < count {
                        var waitedMs = 0
                        while waitedMs < 1000 {
                            if self.checkCancelled() { break }
                            usleep(100_000)
                            waitedMs += 100
                        }
                    }
                    continue
                }

                sent += 1
                var probeOutcome = "TIMEOUT"
                var probeMessage: String? = "Request timed out"
                var probeTimeMs: Double? = nil
                var probeTtl: Int? = nil

                let deadlineNs = startNs + UInt64(timeoutMs) * 1_000_000
                var recvBuf = [UInt8](repeating: 0, count: 1500)
                var cancelledDuringWait = false

                while true {
                    if self.checkCancelled() {
                        cancelledDuringWait = true
                        break
                    }

                    let nowNs = DispatchTime.now().uptimeNanoseconds
                    if nowNs >= deadlineNs {
                        break
                    }

                    let remainingNs = deadlineNs - nowNs
                    let remainingMs = Int((remainingNs + 999_999) / 1_000_000)
                    let sliceMs = Int32(min(max(remainingMs, 1), 100))

                    var pfd = pollfd(fd: sock, events: Int16(POLLIN), revents: 0)
                    let pollRes = poll(&pfd, 1, sliceMs)

                    if pollRes < 0 {
                        let err = errno
                        if err == EINTR {
                            continue
                        }
                        probeOutcome = "ERROR"
                        probeMessage = "Ping failed"
                        break
                    } else if pollRes == 0 {
                        continue
                    } else {
                        if (pfd.revents & Int16(POLLIN)) != 0 {
                            var fromAddr = sockaddr_storage()
                            var fromLen = socklen_t(MemoryLayout<sockaddr_storage>.size)
                            let bytesRead = withUnsafeMutablePointer(to: &fromAddr) { ptr in
                                ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { saPtr in
                                    recvfrom(sock, &recvBuf, recvBuf.count, 0, saPtr, &fromLen)
                                }
                            }

                            if bytesRead < 0 {
                                let err = errno
                                if err == EAGAIN || err == EWOULDBLOCK || err == EINTR {
                                    continue
                                }
                                if err == ENETUNREACH || err == EHOSTUNREACH || err == EHOSTDOWN || err == ENETDOWN || err == ECONNREFUSED {
                                    probeOutcome = "UNREACHABLE"
                                    probeMessage = "Destination unreachable"
                                } else {
                                    probeOutcome = "ERROR"
                                    probeMessage = "Ping failed"
                                }
                                break
                            } else if bytesRead > 0 {
                                let parseResult = parseReply(family: selectedFamily, buf: recvBuf, length: bytesRead, expectedSeq: seq)
                                switch parseResult {
                                case .reply(let ttl):
                                    let endNs = DispatchTime.now().uptimeNanoseconds
                                    let elapsedNs = endNs > startNs ? (endNs - startNs) : 0
                                    let elapsedMs = Double(elapsedNs) / 1_000_000.0
                                    let roundedMs = (elapsedMs * 10.0).rounded() / 10.0
                                    probeOutcome = "REPLY"
                                    probeMessage = nil
                                    probeTimeMs = roundedMs
                                    probeTtl = ttl
                                case .unreachable:
                                    probeOutcome = "UNREACHABLE"
                                    probeMessage = "Destination unreachable"
                                case .ignore:
                                    continue
                                }
                                break
                            }
                        }
                    }
                }

                if cancelledDuringWait {
                    sent -= 1
                    break
                }

                if probeOutcome == "REPLY", let t = probeTimeMs {
                    received += 1
                    sumMs += t
                    if let curMin = minMs {
                        if t < curMin { minMs = t }
                    } else {
                        minMs = t
                    }
                    if let curMax = maxMs {
                        if t > curMax { maxMs = t }
                    } else {
                        maxMs = t
                    }
                }

                let timeValue: Any
                if let t = probeTimeMs { timeValue = t } else { timeValue = NSNull() }
                let ttlValue: Any
                if let ttl = probeTtl { ttlValue = ttl } else { ttlValue = NSNull() }
                let addrValue: Any = resolvedAddressStr.isEmpty ? NSNull() : resolvedAddressStr
                let msgValue: Any
                if let msg = probeMessage { msgValue = msg } else { msgValue = NSNull() }

                self.notifyListeners("probe", data: [
                    "seq": seq,
                    "outcome": probeOutcome,
                    "timeMs": timeValue,
                    "ttl": ttlValue,
                    "resolvedAddress": addrValue,
                    "message": msgValue
                ])

                if seq < count {
                    var waitedMs = 0
                    while waitedMs < 1000 {
                        if self.checkCancelled() {
                            break
                        }
                        usleep(100_000)
                        waitedMs += 100
                    }
                }
            }

            let wasCancelled = self.getAndClearState()
            let lossPercent = sent > 0 ? Int(((Double(sent - received) / Double(sent)) * 100.0).rounded()) : 0

            let minMsValue: Any
            if let min = minMs { minMsValue = min } else { minMsValue = NSNull() }
            let maxMsValue: Any
            if let max = maxMs { maxMsValue = max } else { maxMsValue = NSNull() }
            let avgMsValue: Any
            if received > 0 {
                avgMsValue = (sumMs / Double(received) * 10.0).rounded() / 10.0
            } else {
                avgMsValue = NSNull()
            }
            let finalAddrValue: Any = resolvedAddressStr.isEmpty ? NSNull() : resolvedAddressStr

            call.resolve([
                "host": host,
                "resolvedAddress": finalAddrValue,
                "sent": sent,
                "received": received,
                "lossPercent": lossPercent,
                "minMs": minMsValue,
                "avgMs": avgMsValue,
                "maxMs": maxMsValue,
                "cancelled": wasCancelled
            ])
        }
    }

    @objc public func stop(_ call: CAPPluginCall) {
        stateLock.lock()
        if isRunning {
            isCancelled = true
        }
        stateLock.unlock()
        call.resolve()
    }
}
