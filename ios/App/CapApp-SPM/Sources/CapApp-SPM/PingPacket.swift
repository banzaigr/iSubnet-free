import Foundation
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
    return UInt16(truncatingIfNeeded: ~sum)
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

func clampProbeCount(_ raw: Int) -> Int { return min(max(raw, 1), 100) }
func clampTimeoutMs(_ raw: Int) -> Int { return min(max(raw, 1000), 5000) }
