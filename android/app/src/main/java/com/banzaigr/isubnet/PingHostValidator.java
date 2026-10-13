package com.banzaigr.isubnet;

public class PingHostValidator {

    public static boolean isValid(String host) {
        if (host == null) {
            return false;
        }
        int len = host.length();
        if (len < 1 || len > 253) {
            return false;
        }
        if (host.startsWith("-")) {
            return false;
        }
        for (int i = 0; i < len; i++) {
            char c = host.charAt(i);
            boolean ok = (c >= 'a' && c <= 'z') ||
                         (c >= 'A' && c <= 'Z') ||
                         (c >= '0' && c <= '9') ||
                         c == '.' || c == '-' || c == '_' || c == ':';
            if (!ok) {
                return false;
            }
        }
        return true;
    }
}
