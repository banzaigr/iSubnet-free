package com.banzaigr.isubnet;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class PingOutputParser {
    public enum Outcome {
        REPLY,
        TIMEOUT,
        UNREACHABLE,
        UNKNOWN_HOST,
        ERROR
    }

    public static class Result {
        public final Outcome outcome;
        public final Double timeMs;
        public final Integer ttl;
        public final String resolvedAddress;
        public final String message;

        public Result(Outcome outcome, Double timeMs, Integer ttl, String resolvedAddress, String message) {
            this.outcome = outcome;
            this.timeMs = timeMs;
            this.ttl = ttl;
            this.resolvedAddress = resolvedAddress;
            this.message = message;
        }

        @Override
        public String toString() {
            return "Result{" +
                    "outcome=" + outcome +
                    ", timeMs=" + timeMs +
                    ", ttl=" + ttl +
                    ", resolvedAddress='" + resolvedAddress + '\'' +
                    ", message='" + message + '\'' +
                    '}';
        }
    }

    private static final Pattern PING_HEADER_PATTERN =
            Pattern.compile("PING\\s+[^\\s(]+\\s*\\(([^)]+)\\)", Pattern.CASE_INSENSITIVE);

    private static final Pattern TTL_PATTERN =
            Pattern.compile("\\bttl=(\\d+)\\b", Pattern.CASE_INSENSITIVE);

    private static final Pattern TIME_PATTERN =
            Pattern.compile("\\btime=([0-9.]+)\\s*(?:ms)?\\b", Pattern.CASE_INSENSITIVE);

    public static Result parse(String output) {
        if (output == null || output.trim().isEmpty()) {
            return new Result(Outcome.ERROR, null, null, null, "No output from ping");
        }

        String resolvedAddress = null;
        Matcher headerMatcher = PING_HEADER_PATTERN.matcher(output);
        if (headerMatcher.find()) {
            resolvedAddress = headerMatcher.group(1).trim();
        }

        String[] lines = output.split("\\r?\\n");
        boolean hasReply = false;
        Double timeMs = null;
        Integer ttl = null;

        boolean hasUnreachable = false;
        boolean hasUnknownHost = false;
        boolean hasTimeout = false;
        boolean hasPermissionError = false;
        boolean hasNotFoundError = false;
        boolean hasUsage = false;

        for (String rawLine : lines) {
            String line = rawLine.trim();
            if (line.isEmpty()) continue;

            String lower = line.toLowerCase(Locale.ROOT);

            // Check for reply line
            if (lower.contains("bytes from") && (lower.contains("time=") || lower.contains("time<"))) {
                hasReply = true;
                if (lower.contains("time<1") || lower.contains("time< 1")) {
                    timeMs = 0.5;
                } else {
                    Matcher mTime = TIME_PATTERN.matcher(line);
                    if (mTime.find()) {
                        try {
                            timeMs = Double.parseDouble(mTime.group(1));
                        } catch (NumberFormatException ignored) {}
                    }
                }

                Matcher mTtl = TTL_PATTERN.matcher(line);
                if (mTtl.find()) {
                    try {
                        ttl = Integer.parseInt(mTtl.group(1));
                    } catch (NumberFormatException ignored) {}
                }
                break;
            }

            if (lower.contains("destination host unreachable") || lower.contains("destination net unreachable")
                    || lower.contains("destination protocol unreachable") || lower.contains("destination port unreachable")) {
                hasUnreachable = true;
            }

            if (lower.contains("unknown host") || lower.contains("bad address")
                    || lower.contains("name or service not known")) {
                hasUnknownHost = true;
            }

            if (lower.contains("100% packet loss") || lower.contains("100.0% packet loss")
                    || lower.contains("100% loss") || lower.contains("request timeout")
                    || lower.contains("0 packets received") || lower.contains("0 received")) {
                hasTimeout = true;
            }

            if (lower.contains("operation not permitted") || lower.contains("permission denied")) {
                hasPermissionError = true;
            }

            if (lower.contains("not found") || lower.contains("no such file")) {
                hasNotFoundError = true;
            }

            if (lower.startsWith("usage:") || lower.contains("usage: ping")) {
                hasUsage = true;
            }
        }

        if (hasReply) {
            return new Result(Outcome.REPLY, timeMs, ttl, resolvedAddress, null);
        }

        if (hasUnknownHost) {
            return new Result(Outcome.UNKNOWN_HOST, null, null, resolvedAddress, "Unknown host");
        }

        if (hasUnreachable) {
            return new Result(Outcome.UNREACHABLE, null, null, resolvedAddress, "Destination unreachable");
        }

        if (hasTimeout) {
            return new Result(Outcome.TIMEOUT, null, null, resolvedAddress, "Request timed out");
        }

        if (hasPermissionError) {
            return new Result(Outcome.ERROR, null, null, resolvedAddress, "Operation not permitted");
        }

        if (hasNotFoundError) {
            return new Result(Outcome.ERROR, null, null, resolvedAddress, "Ping binary not found");
        }

        if (hasUsage) {
            return new Result(Outcome.ERROR, null, null, resolvedAddress, "Invalid ping arguments");
        }

        return new Result(Outcome.ERROR, null, null, resolvedAddress, "Ping failed");
    }
}
