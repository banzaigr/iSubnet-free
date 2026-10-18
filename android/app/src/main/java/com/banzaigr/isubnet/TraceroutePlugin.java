package com.banzaigr.isubnet;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;

@CapacitorPlugin(name = "Traceroute")
public class TraceroutePlugin extends Plugin {

    private static final int PROBE_GAP_MS = 30;
    private static final int POLL_SLICE_MS = 25;

    private static boolean nativeLoaded = false;
    private static String nativeLoadError = null;

    static {
        try {
            System.loadLibrary("isubnet_traceroute");
            nativeLoaded = true;
        } catch (Throwable t) {
            nativeLoaded = false;
            nativeLoadError = t.getMessage();
        }
    }

    private static native int nativeOpenSocket();
    private static native void nativeCloseSocket(int fd);
    private static native void nativeDrainSocket(int fd);
    private static native String nativeErrnoMessage(int errnum);
    private static native void nativeSetCancelled(boolean cancelled);
    private static native long nativeSendProbe(int fd, String destIp, int ttl, int seq);
    private static native String nativePollProbe(int fd, int seqMin, int seqMax, int sliceMs);

    private final ExecutorService traceExecutor = Executors.newSingleThreadExecutor();
    private final ExecutorService dnsExecutor = Executors.newCachedThreadPool(r -> {
        Thread t = new Thread(r, "isubnet-trace-dns");
        t.setDaemon(true);
        return t;
    });

    private final Object lock = new Object();
    private boolean isRunning = false;
    private volatile boolean isCancelled = false;
    private final AtomicInteger currentRunId = new AtomicInteger(0);

    private static int clamp(int val, int min, int max) {
        if (val < min) return min;
        if (val > max) return max;
        return val;
    }

    private static String formatErrnoMessage(int errnum) {
        String detail = nativeLoaded ? nativeErrnoMessage(errnum) : null;
        if (errnum == 1 || errnum == 13) {
            return "Traceroute is not permitted on this device (" + (detail != null ? detail : "errno " + errnum) + ")";
        }
        if (errnum == 101) {
            return "Network is unreachable (" + (detail != null ? detail : "errno " + errnum) + ")";
        }
        if (errnum == 113) {
            return "No route to host (" + (detail != null ? detail : "errno " + errnum) + ")";
        }
        if (errnum == 100) {
            return "Network is down (" + (detail != null ? detail : "errno " + errnum) + ")";
        }
        return "Traceroute socket error (errno " + errnum + (detail != null ? ": " + detail : "") + ")";
    }

    private void cancelRunning() {
        synchronized (lock) {
            if (isRunning) {
                isCancelled = true;
                if (nativeLoaded) {
                    nativeSetCancelled(true);
                }
                lock.notifyAll();
            }
        }
    }

    private boolean isCancelledNow() {
        synchronized (lock) {
            return isCancelled;
        }
    }

    private String resolveIpv4WithTimeout(final String host) {
        if (host.matches("\\d{1,3}(\\.\\d{1,3}){3}")) {
            String[] octets = host.split("\\.");
            for (String octet : octets) {
                if (Integer.parseInt(octet) > 255) {
                    return null;
                }
            }
            return host;
        }
        Future<InetAddress[]> future = null;
        try {
            future = dnsExecutor.submit(() -> InetAddress.getAllByName(host));
            /* Wait in short slices (8 s total) so Stop is honoured immediately instead of after the lookup ends. */
            final long deadlineNs = System.nanoTime() + 8_000_000_000L;
            while (true) {
                if (isCancelledNow()) {
                    future.cancel(true);
                    return null;
                }
                long remMs = (deadlineNs - System.nanoTime()) / 1_000_000L;
                if (remMs <= 0) {
                    future.cancel(true);
                    return null;
                }
                try {
                    InetAddress[] addrs = future.get(Math.min(100L, remMs), TimeUnit.MILLISECONDS);
                    if (addrs != null) {
                        for (InetAddress addr : addrs) {
                            if (addr instanceof Inet4Address) {
                                return addr.getHostAddress();
                            }
                        }
                    }
                    return null;
                } catch (TimeoutException slice) {
                    /* keep waiting */
                }
            }
        } catch (Exception ignored) {
            if (future != null) {
                future.cancel(true);
            }
        }
        return null;
    }

    @PluginMethod
    public void trace(PluginCall call) {
        String rawHost = call.getString("host");
        if (rawHost == null) {
            call.reject("Invalid host");
            return;
        }
        final String host = rawHost.trim();
        if (!PingHostValidator.isValid(host)) {
            call.reject("Invalid host");
            return;
        }
        if (host.contains(":")) {
            call.reject("IPv6 traceroute is not supported yet");
            return;
        }
        if (!nativeLoaded) {
            call.reject("Traceroute is not available on this device" + (nativeLoadError != null ? ": " + nativeLoadError : ""));
            return;
        }

        Integer rawMaxHops = call.getInt("maxHops", 30);
        final int maxHops = clamp(rawMaxHops != null ? rawMaxHops : 30, 1, 64);

        Integer rawProbes = call.getInt("probes", 3);
        final int probes = clamp(rawProbes != null ? rawProbes : 3, 1, 5);

        Integer rawTimeout = call.getInt("timeoutMs", 2000);
        final int timeoutMs = clamp(rawTimeout != null ? rawTimeout : 2000, 500, 5000);

        final boolean resolveNames = Boolean.TRUE.equals(call.getBoolean("resolveNames", false));

        synchronized (lock) {
            if (isRunning) {
                call.reject("Traceroute already running");
                return;
            }
            isRunning = true;
            isCancelled = false;
            nativeSetCancelled(false);
        }

        final int runId = currentRunId.incrementAndGet();

        traceExecutor.execute(() -> {
            int fd = -1;
            String resolvedAddress = null;
            int lastTtl = 0;
            boolean reached = false;
            boolean unreachable = false;
            boolean rejected = false;

            try {
                resolvedAddress = resolveIpv4WithTimeout(host);
                if (isCancelledNow()) {
                    return;
                }
                if (resolvedAddress == null || resolvedAddress.isEmpty()) {
                    rejected = true;
                    call.reject("Unknown host");
                    return;
                }

                if (isCancelledNow()) {
                    return;
                }

                fd = nativeOpenSocket();
                if (fd < 0) {
                    int err = -fd;
                    rejected = true;
                    call.reject(formatErrnoMessage(err));
                    return;
                }

                JSObject resolvedEvent = new JSObject();
                resolvedEvent.put("address", resolvedAddress);
                notifyListeners("resolved", resolvedEvent);

                final Set<String> seenAddresses = Collections.synchronizedSet(new HashSet<>());
                final String finalDestIp = resolvedAddress;
                int seqBase = 0;

                for (int ttl = 1; ttl <= maxHops; ttl++) {
                    if (isCancelledNow()) {
                        break;
                    }
                    lastTtl = ttl;

                    /* Drain stale packets from earlier hops before any probe of this TTL is sent. */
                    nativeDrainSocket(fd);

                    final int firstSeq = seqBase + 1;
                    final int lastSeq = seqBase + probes;
                    final long[] sentUs = new long[probes + 1];
                    final long[] deadlineNs = new long[probes + 1];
                    final boolean[] done = new boolean[probes + 1];
                    int pending = 0;
                    int localSendErrors = 0;
                    int lastErrno = 0;
                    final boolean[] hopFlags = new boolean[2]; /* [0]=reached, [1]=unreachable */

                    for (int p = 1; p <= probes; p++) {
                        seqBase++;
                        if (isCancelledNow()) {
                            done[p] = true;
                            break;
                        }

                        long sendRes = nativeSendProbe(fd, finalDestIp, ttl, seqBase);
                        if (sendRes <= 0) {
                            done[p] = true;
                            localSendErrors++;
                            lastErrno = (int) (-sendRes);
                            emitHopEvent(ttl, p, "ERROR", null, null);
                            continue;
                        }

                        sentUs[p] = sendRes;
                        deadlineNs[p] = System.nanoTime() + timeoutMs * 1_000_000L;
                        pending++;

                        if (p < probes) {
                            /* Poll throughout the full 30 ms inter-probe gap so probes are sent ~30 ms apart
                             * even when an earlier probe is answered in a few milliseconds. */
                            long gapDeadlineNs = System.nanoTime() + PROBE_GAP_MS * 1_000_000L;
                            while (!isCancelledNow()) {
                                long remMs = (gapDeadlineNs - System.nanoTime() + 999_999L) / 1_000_000L;
                                if (remMs <= 0) {
                                    break;
                                }
                                String raw = nativePollProbe(fd, firstSeq, lastSeq, (int) remMs);
                                pending -= handlePollResult(
                                    raw, ttl, firstSeq, sentUs, done, hopFlags,
                                    finalDestIp, resolveNames, seenAddresses, runId
                                );
                            }
                        }
                    }

                    while (pending > 0 && !isCancelledNow()) {
                        String raw = nativePollProbe(fd, firstSeq, lastSeq, POLL_SLICE_MS);
                        pending -= handlePollResult(
                            raw, ttl, firstSeq, sentUs, done, hopFlags,
                            finalDestIp, resolveNames, seenAddresses, runId
                        );
                        long nowNs = System.nanoTime();
                        for (int p = 1; p <= probes; p++) {
                            if (!done[p] && nowNs >= deadlineNs[p]) {
                                done[p] = true;
                                pending--;
                                emitHopEvent(ttl, p, "TIMEOUT", null, null);
                            }
                        }
                    }

                    if (isCancelledNow()) {
                        break;
                    }
                    if (localSendErrors == probes) {
                        rejected = true;
                        call.reject(formatErrnoMessage(lastErrno));
                        return;
                    }
                    if (hopFlags[0]) {
                        reached = true;
                        break;
                    }
                    if (hopFlags[1]) {
                        unreachable = true;
                        break;
                    }
                }
            } finally {
                if (fd >= 0) {
                    nativeCloseSocket(fd);
                }
                boolean wasCancelled;
                synchronized (lock) {
                    wasCancelled = isCancelled;
                    isRunning = false;
                    isCancelled = false;
                    if (nativeLoaded) {
                        nativeSetCancelled(false);
                    }
                }
                if (!rejected) {
                    JSObject ret = new JSObject();
                    ret.put("host", host);
                    if (resolvedAddress != null) {
                        ret.put("resolvedAddress", resolvedAddress);
                    } else {
                        ret.put("resolvedAddress", JSObject.NULL);
                    }
                    ret.put("hops", lastTtl);
                    ret.put("reached", reached);
                    ret.put("unreachable", unreachable);
                    ret.put("cancelled", wasCancelled);
                    call.resolve(ret);
                }
            }
        });
    }

    private int handlePollResult(
        String raw,
        int ttl,
        int firstSeq,
        long[] sentUs,
        boolean[] done,
        boolean[] hopFlags,
        String destIp,
        boolean resolveNames,
        Set<String> seenAddresses,
        int runId
    ) {
        if (raw == null || raw.isEmpty() || raw.startsWith("PENDING|") || raw.startsWith("CANCELLED|")) {
            return 0;
        }
        String[] parts = raw.split("\\|", -1);
        if (parts.length < 4) {
            return 0;
        }
        String kind = parts[0];
        if ("ERROR".equals(kind)) {
            return 0;
        }
        try {
            int seq = Integer.parseInt(parts[1]);
            long recvUs = Long.parseLong(parts[2]);
            String addr = parts[3];
            int p = seq - firstSeq + 1;
            if (p < 1 || p >= sentUs.length || done[p] || sentUs[p] <= 0) {
                return 0;
            }
            done[p] = true;
            double ms = Math.round(((recvUs - sentUs[p]) / 1000.0) * 10.0) / 10.0;
            if (ms < 0.0) {
                ms = 0.0;
            }
            if ("REPLY".equals(kind)) {
                hopFlags[0] = true;
                if (addr == null || addr.isEmpty()) {
                    addr = destIp;
                }
            } else if ("UNREACHABLE".equals(kind)) {
                hopFlags[1] = true;
            }
            String finalAddr = (addr != null && !addr.isEmpty()) ? addr : null;
            emitHopEvent(ttl, p, kind, finalAddr, ms);
            if (resolveNames && finalAddr != null && seenAddresses.add(finalAddr)) {
                scheduleReverseDns(finalAddr, runId);
            }
            return 1;
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private void emitHopEvent(int ttl, int probe, String outcome, String address, Double timeMs) {
        JSObject hopEvent = new JSObject();
        hopEvent.put("ttl", ttl);
        hopEvent.put("probe", probe);
        hopEvent.put("outcome", outcome);
        if (address != null) {
            hopEvent.put("address", address);
        } else {
            hopEvent.put("address", JSObject.NULL);
        }
        if (timeMs != null) {
            hopEvent.put("timeMs", timeMs);
        } else {
            hopEvent.put("timeMs", JSObject.NULL);
        }
        notifyListeners("hop", hopEvent);
    }

    private void scheduleReverseDns(final String ipAddress, final int expectedRunId) {
        dnsExecutor.execute(() -> {
            if (currentRunId.get() != expectedRunId) {
                return;
            }
            Future<String> future = null;
            try {
                future = dnsExecutor.submit(() -> {
                    String[] octets = ipAddress.split("\\.");
                    if (octets.length != 4) {
                        return null;
                    }
                    byte[] rawBytes = new byte[4];
                    for (int i = 0; i < 4; i++) {
                        rawBytes[i] = (byte) (Integer.parseInt(octets[i]) & 0xFF);
                    }
                    return InetAddress.getByAddress(rawBytes).getCanonicalHostName();
                });
                String canonical = future.get(3, TimeUnit.SECONDS);
                if (currentRunId.get() != expectedRunId) {
                    return;
                }
                if (canonical != null) {
                    canonical = canonical.trim();
                    while (canonical.endsWith(".")) {
                        canonical = canonical.substring(0, canonical.length() - 1);
                    }
                }
                JSObject ev = new JSObject();
                ev.put("address", ipAddress);
                if (canonical != null && !canonical.isEmpty() && !canonical.equals(ipAddress)) {
                    ev.put("hostname", canonical);
                } else {
                    ev.put("hostname", JSObject.NULL);
                    ev.put("reason", "none");
                }
                notifyListeners("hostname", ev);
            } catch (TimeoutException te) {
                if (future != null) {
                    future.cancel(true);
                }
                if (currentRunId.get() == expectedRunId) {
                    JSObject ev = new JSObject();
                    ev.put("address", ipAddress);
                    ev.put("hostname", JSObject.NULL);
                    ev.put("reason", "timeout");
                    notifyListeners("hostname", ev);
                }
            } catch (Exception ignored) {
                if (future != null) {
                    future.cancel(true);
                }
                if (currentRunId.get() == expectedRunId) {
                    JSObject ev = new JSObject();
                    ev.put("address", ipAddress);
                    ev.put("hostname", JSObject.NULL);
                    ev.put("reason", "error");
                    notifyListeners("hostname", ev);
                }
            }
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        cancelRunning();
        call.resolve();
    }

    @Override
    protected void handleOnStop() {
        super.handleOnStop();
        cancelRunning();
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        cancelRunning();
        dnsExecutor.shutdownNow();
        traceExecutor.shutdownNow();
    }
}
