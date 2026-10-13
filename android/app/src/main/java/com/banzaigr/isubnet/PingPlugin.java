package com.banzaigr.isubnet;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "Ping")
public class PingPlugin extends Plugin {

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final ScheduledExecutorService watchdogExecutor = Executors.newSingleThreadScheduledExecutor();

    private final Object lock = new Object();
    private boolean isRunning = false;
    private volatile boolean isCancelled = false;
    private Process currentProcess = null;

    @PluginMethod
    public void ping(PluginCall call) {
        String host = call.getString("host");
        if (!PingHostValidator.isValid(host)) {
            call.reject("Invalid host");
            return;
        }

        host = host.trim();

        File pingBin = new File("/system/bin/ping");
        if (!pingBin.exists() || !pingBin.canExecute()) {
            call.reject("Ping is not available on this device");
            return;
        }

        boolean continuous = Boolean.TRUE.equals(call.getBoolean("continuous", false));

        int count = call.getInt("count", 4);
        if (count < 1) count = 1;
        if (count > 100) count = 100;

        int timeoutMs = call.getInt("timeoutMs", 3000);
        if (timeoutMs < 1000) timeoutMs = 1000;
        if (timeoutMs > 5000) timeoutMs = 5000;

        final String targetHost = host;
        final int targetCount = count;
        final int targetTimeoutMs = timeoutMs;
        final boolean targetContinuous = continuous;

        synchronized (lock) {
            if (isRunning) {
                call.reject("Ping already running");
                return;
            }
            isRunning = true;
            isCancelled = false;
        }

        executor.execute(() -> {
            boolean rejected = false;
            int sent = 0;
            int received = 0;
            Double minMs = null;
            Double maxMs = null;
            double sumMs = 0.0;
            String resolvedAddress = null;

            try {
                for (int i = 1; targetContinuous || i <= targetCount; i++) {
                    synchronized (lock) {
                        if (isCancelled) {
                            break;
                        }
                    }

                    int timeoutSec = (int) Math.ceil((double) targetTimeoutMs / 1000.0);
                    List<String> args = new ArrayList<>();
                    args.add("/system/bin/ping");
                    if (targetHost.contains(":")) {
                        args.add("-6");
                    }
                    args.add("-c");
                    args.add("1");
                    args.add("-W");
                    args.add(String.valueOf(timeoutSec));
                    args.add(targetHost);

                    StringBuilder outputBuilder = new StringBuilder();
                    Process process = null;
                    ScheduledFuture<?> watchdogTask = null;
                    final AtomicBoolean watchdogFired = new AtomicBoolean(false);
                    boolean ioExceptionOccurred = false;

                    try {
                        ProcessBuilder pb = new ProcessBuilder(args);
                        pb.redirectErrorStream(true);
                        process = pb.start();
                        synchronized (lock) {
                            currentProcess = process;
                        }

                        final Process procToWatch = process;
                        watchdogTask = watchdogExecutor.schedule(() -> {
                            try {
                                watchdogFired.set(true);
                                procToWatch.destroy();
                            } catch (Exception ignored) {}
                        }, targetTimeoutMs + 2000L, TimeUnit.MILLISECONDS);

                        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                            String line;
                            while ((line = reader.readLine()) != null) {
                                outputBuilder.append(line).append("\n");
                            }
                        }

                        process.waitFor();
                    } catch (IOException e) {
                        ioExceptionOccurred = true;
                    } catch (InterruptedException e) {
                        if (process != null) {
                            process.destroy();
                        }
                        Thread.currentThread().interrupt();
                    } finally {
                        if (watchdogTask != null) {
                            watchdogTask.cancel(true);
                        }
                        synchronized (lock) {
                            currentProcess = null;
                        }
                    }

                    synchronized (lock) {
                        if (isCancelled) {
                            break;
                        }
                    }

                    if (watchdogFired.get()) {
                        sent++;
                        JSObject probeEvent = new JSObject();
                        probeEvent.put("seq", i);
                        probeEvent.put("outcome", "TIMEOUT");
                        probeEvent.put("timeMs", JSObject.NULL);
                        probeEvent.put("ttl", JSObject.NULL);
                        if (resolvedAddress != null) probeEvent.put("resolvedAddress", resolvedAddress);
                        else probeEvent.put("resolvedAddress", JSObject.NULL);
                        probeEvent.put("message", "Request timed out");
                        notifyListeners("probe", probeEvent);

                        if (targetContinuous || i < targetCount) {
                            synchronized (lock) {
                                if (isCancelled) break;
                            }
                            try {
                                Thread.sleep(1000);
                            } catch (InterruptedException e) {
                                Thread.currentThread().interrupt();
                                break;
                            }
                        }
                        continue;
                    }

                    if (ioExceptionOccurred) {
                        if (i == 1 && !targetHost.contains(":")) {
                            rejected = true;
                            call.reject("Ping is not available on this device");
                            return;
                        }
                        String errMsg = targetHost.contains(":") ? "IPv6 ping not supported or failed" : "Ping process execution failed";
                        PingOutputParser.Result parsed = new PingOutputParser.Result(PingOutputParser.Outcome.ERROR, null, null, resolvedAddress, errMsg);
                        sent++;
                        JSObject probeEvent = new JSObject();
                        probeEvent.put("seq", i);
                        probeEvent.put("outcome", parsed.outcome.name());
                        probeEvent.put("timeMs", JSObject.NULL);
                        probeEvent.put("ttl", JSObject.NULL);
                        if (resolvedAddress != null) probeEvent.put("resolvedAddress", resolvedAddress);
                        else probeEvent.put("resolvedAddress", JSObject.NULL);
                        probeEvent.put("message", parsed.message);
                        notifyListeners("probe", probeEvent);
                        if (targetContinuous || i < targetCount) {
                            synchronized (lock) {
                                if (isCancelled) break;
                            }
                            try {
                                Thread.sleep(1000);
                            } catch (InterruptedException e) {
                                Thread.currentThread().interrupt();
                                break;
                            }
                        }
                        continue;
                    }

                    PingOutputParser.Result parsed = PingOutputParser.parse(outputBuilder.toString());
                    sent++;

                    if (resolvedAddress == null && parsed.resolvedAddress != null) {
                        resolvedAddress = parsed.resolvedAddress;
                    }

                    if (parsed.outcome == PingOutputParser.Outcome.REPLY && parsed.timeMs != null) {
                        received++;
                        double t = parsed.timeMs;
                        sumMs += t;
                        if (minMs == null || t < minMs) minMs = t;
                        if (maxMs == null || t > maxMs) maxMs = t;
                    }

                    JSObject probeEvent = new JSObject();
                    probeEvent.put("seq", i);
                    probeEvent.put("outcome", parsed.outcome.name());
                    if (parsed.timeMs != null) probeEvent.put("timeMs", parsed.timeMs);
                    else probeEvent.put("timeMs", JSObject.NULL);
                    if (parsed.ttl != null) probeEvent.put("ttl", parsed.ttl);
                    else probeEvent.put("ttl", JSObject.NULL);
                    if (parsed.resolvedAddress != null) probeEvent.put("resolvedAddress", parsed.resolvedAddress);
                    else if (resolvedAddress != null) probeEvent.put("resolvedAddress", resolvedAddress);
                    else probeEvent.put("resolvedAddress", JSObject.NULL);
                    if (parsed.message != null) probeEvent.put("message", parsed.message);
                    else probeEvent.put("message", JSObject.NULL);

                    notifyListeners("probe", probeEvent);

                    if (targetContinuous && parsed.outcome == PingOutputParser.Outcome.UNKNOWN_HOST && resolvedAddress == null) {
                        break;
                    }

                    if (targetContinuous || i < targetCount) {
                        synchronized (lock) {
                            if (isCancelled) break;
                        }
                        try {
                            Thread.sleep(1000);
                        } catch (InterruptedException e) {
                            Thread.currentThread().interrupt();
                            break;
                        }
                    }
                }
            } finally {
                boolean wasCancelled;
                synchronized (lock) {
                    wasCancelled = isCancelled;
                    isRunning = false;
                    isCancelled = false;
                    currentProcess = null;
                }

                if (!rejected) {
                    int lossPercent = sent > 0 ? (int) Math.round(((double)(sent - received) / (double) sent) * 100.0) : 0;
                    Double avgMs = received > 0 ? Math.round((sumMs / received) * 10.0) / 10.0 : null;

                    JSObject ret = new JSObject();
                    ret.put("host", targetHost);
                    if (resolvedAddress != null) ret.put("resolvedAddress", resolvedAddress);
                    else ret.put("resolvedAddress", JSObject.NULL);
                    ret.put("sent", sent);
                    ret.put("received", received);
                    ret.put("lossPercent", lossPercent);
                    if (minMs != null) ret.put("minMs", minMs);
                    else ret.put("minMs", JSObject.NULL);
                    if (avgMs != null) ret.put("avgMs", avgMs);
                    else ret.put("avgMs", JSObject.NULL);
                    if (maxMs != null) ret.put("maxMs", maxMs);
                    else ret.put("maxMs", JSObject.NULL);
                    ret.put("cancelled", wasCancelled);

                    call.resolve(ret);
                }
            }
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        synchronized (lock) {
            if (isRunning) {
                isCancelled = true;
                if (currentProcess != null) {
                    currentProcess.destroy();
                }
            }
        }
        call.resolve();
    }

    @Override
    protected void handleOnStop() {
        super.handleOnStop();
        synchronized (lock) {
            if (isRunning) {
                isCancelled = true;
                if (currentProcess != null) {
                    currentProcess.destroy();
                }
            }
        }
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        synchronized (lock) {
            isCancelled = true;
            if (currentProcess != null) {
                currentProcess.destroy();
            }
        }
        watchdogExecutor.shutdownNow();
        executor.shutdownNow();
    }
}
