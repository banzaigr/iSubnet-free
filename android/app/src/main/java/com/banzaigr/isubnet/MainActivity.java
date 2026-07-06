package com.banzaigr.isubnet;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Read theme preference from CapacitorStorage (written by Capacitor Preferences plugin)
        SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String darkMode = prefs.getString("_cap_isubnet_dark_mode", "false");
        boolean isDark = !"false".equals(darkMode);
        
        // Apply light or dark splash screen theme dynamically before calling super.onCreate
        if (isDark) {
            setTheme(R.style.AppTheme_NoActionBarLaunchDark);
        } else {
            setTheme(R.style.AppTheme_NoActionBarLaunchLight);
        }
        
        super.onCreate(savedInstanceState);
    }
}
