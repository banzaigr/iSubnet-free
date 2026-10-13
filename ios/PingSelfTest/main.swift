import Foundation
import Darwin

var failures = 0
func check(_ name: String, _ ok: Bool) {
    print(ok ? "PASS" : "FAIL", name)
    if !ok {
        failures += 1
    }
}

func isReply(_ r: PingParseResult, ttl: Int?) -> Bool {
    switch r {
    case .reply(let t):
        return t == ttl
    default:
        return false
    }
}

func isUnreachable(_ r: PingParseResult) -> Bool {
    switch r {
    case .unreachable:
        return true
    default:
        return false
    }
}

func isIgnore(_ r: PingParseResult) -> Bool {
    switch r {
    case .ignore:
        return true
    default:
        return false
    }
}

// Checksum vectors
check("C1", calculateChecksum([0x00, 0x01, 0xf2, 0x03, 0xf4, 0xf5, 0xf6, 0xf7]) == 0x220D)
check("C2", calculateChecksum([0x08, 0x00, 0x00, 0x00, 0x12, 0x34, 0x00, 0x01]) == 0xE5CA)
check("C3", calculateChecksum([0x01, 0x02, 0x03]) == 0xFBFD)
check("C4", calculateChecksum([0xFF, 0xFF]) == 0x0000)
check("C5", calculateChecksum([0x00, 0x00]) == 0xFFFF)

// buildPacket IPv4 for seq in [1, 2, 10, 255, 256, 65535, 65536, 70000]
let testSeqs = [1, 2, 10, 255, 256, 65535, 65536, 70000]
var p1Ok = true
var p2Ok = true
var p3Ok = true
var p4Ok = true

for seq in testSeqs {
    let packet = buildPacket(family: AF_INET, seq: seq)
    if !(packet.count == 64 && packet[0] == 8 && packet[1] == 0) {
        p1Ok = false
    }
    let expectedHi = UInt8(((seq & 0xFFFF) >> 8) & 0xFF)
    let expectedLo = UInt8((seq & 0xFFFF) & 0xFF)
    if !(packet[6] == expectedHi && packet[7] == expectedLo) {
        p2Ok = false
    }
    if calculateChecksum(packet) != 0 {
        p3Ok = false
    }
    if !(packet[8] == 0 && packet[63] == 55) {
        p4Ok = false
    }
}
check("P1", p1Ok)
check("P2", p2Ok)
check("P3", p3Ok)
check("P4", p4Ok)

// buildPacket IPv6 for seq 3
let p6 = buildPacket(family: AF_INET6, seq: 3)
let p5Ok = p6.count == 64 && p6[0] == 128 && p6[1] == 0 && p6[2] == 0 && p6[3] == 0 && p6[6] == 0 && p6[7] == 3
check("P5", p5Ok)

// parseReply IPv4
var buf4 = [UInt8](repeating: 0, count: 1500)
buf4[0] = 0x45
buf4[8] = 117
buf4[20] = 0
buf4[21] = 0
buf4[26] = 0
buf4[27] = 3

check("R1", isReply(parseReply(family: AF_INET, buf: buf4, length: 28, expectedSeq: 3), ttl: 117))
check("R2", isIgnore(parseReply(family: AF_INET, buf: buf4, length: 28, expectedSeq: 4)))

buf4[20] = 3
check("R3", isUnreachable(parseReply(family: AF_INET, buf: buf4, length: 28, expectedSeq: 3)))
buf4[20] = 0

check("R4", isIgnore(parseReply(family: AF_INET, buf: buf4, length: 27, expectedSeq: 3)))

var buf4_24 = [UInt8](repeating: 0, count: 1500)
buf4_24[0] = 0x46
buf4_24[8] = 117
buf4_24[24] = 0
buf4_24[25] = 0
buf4_24[30] = 0
buf4_24[31] = 3
check("R5", isReply(parseReply(family: AF_INET, buf: buf4_24, length: 32, expectedSeq: 3), ttl: 117))

var buf4_v6 = buf4
buf4_v6[0] = 0x65
check("R6", isIgnore(parseReply(family: AF_INET, buf: buf4_v6, length: 28, expectedSeq: 3)))

// parseReply IPv6
var buf6 = [UInt8](repeating: 0, count: 1500)
buf6[0] = 129
buf6[1] = 0
buf6[6] = 0
buf6[7] = 3

check("R7", isReply(parseReply(family: AF_INET6, buf: buf6, length: 8, expectedSeq: 3), ttl: nil))

buf6[0] = 1
check("R8", isUnreachable(parseReply(family: AF_INET6, buf: buf6, length: 8, expectedSeq: 3)))

buf6[0] = 129
check("R9", isIgnore(parseReply(family: AF_INET6, buf: buf6, length: 7, expectedSeq: 3)))

// isValidHost
let h1Hosts = ["8.8.8.8", "one.one.one.one", "my-host.example.com", "2606:4700:4700::1111", "a_b.c", "Example.COM"]
let h1Ok = h1Hosts.allSatisfy { isValidHost($0) }
check("H1", h1Ok)

let str254 = String(repeating: "a", count: 254)
let h2Hosts = ["", "-bad", "bad host", "ex!ample.com", "é.com", str254]
let h2Ok = h2Hosts.allSatisfy { !isValidHost($0) }
check("H2", h2Ok)

let str253 = String(repeating: "a", count: 253)
check("H3", isValidHost(str253))

check("K1", clampProbeCount(0) == 1 && clampProbeCount(-5) == 1)
check("K2", clampProbeCount(1) == 1 && clampProbeCount(4) == 4 && clampProbeCount(100) == 100)
check("K3", clampProbeCount(101) == 100 && clampProbeCount(1_000_000) == 100)
check("K4", clampTimeoutMs(500) == 1000 && clampTimeoutMs(3000) == 3000 && clampTimeoutMs(9000) == 5000)

print("failures: \(failures)")
exit(failures == 0 ? 0 : 1)
