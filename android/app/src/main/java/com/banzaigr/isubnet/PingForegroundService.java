package com.banzaigr.isubnet;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.drawable.Icon;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

/**
 * Keeps the app process alive while a Ping run is active so it continues in the background.
 * It does not ping itself; PingPlugin owns the ping loop.
 */
public class PingForegroundService extends Service {
    private static final String ACTION_START = "com.banzaigr.isubnet.PING_SERVICE_START";
    private static final String ACTION_END = "com.banzaigr.isubnet.PING_SERVICE_END";
    private static final String ACTION_CANCEL = "com.banzaigr.isubnet.PING_SERVICE_CANCEL";
    private static final String CHANNEL_ID = "ping_running";
    private static final int NOTIFICATION_ID = 4101;
    private static final long WAKE_LOCK_MAX_MS = 6L * 60L * 60L * 1000L;

    private PowerManager.WakeLock wakeLock;

    static void startForPing(Context context) {
        try {
            Context app = context.getApplicationContext();
            Intent intent = new Intent(app, PingForegroundService.class);
            intent.setAction(ACTION_START);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                app.startForegroundService(intent);
            } else {
                app.startService(intent);
            }
        } catch (Exception ignored) {
            // The ping still runs without the service; it just will not survive in the background.
        }
    }

    static void endForPing(Context context) {
        try {
            Context app = context.getApplicationContext();
            Intent intent = new Intent(app, PingForegroundService.class);
            intent.setAction(ACTION_END);
            app.startService(intent);
        } catch (Exception ignored) {
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_CANCEL.equals(action)) {
            boolean wasRunning = PingPlugin.cancelFromService();
            if (!wasRunning) {
                shutDown();
            }
            return START_NOT_STICKY;
        }
        if (ACTION_END.equals(action)) {
            if (!PingPlugin.isRunningNow()) {
                shutDown();
            }
            return START_NOT_STICKY;
        }
        enterForeground();
        return START_NOT_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        PingPlugin.cancelFromService();
        shutDown();
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        releaseWakeLock();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void enterForeground() {
        try {
            createChannelIfNeeded();
            Notification notification = buildNotification();
            if (Build.VERSION.SDK_INT >= 34) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
            acquireWakeLock();
        } catch (Exception e) {
            stopSelf();
        }
    }

    private void shutDown() {
        releaseWakeLock();
        try {
            stopForeground(Service.STOP_FOREGROUND_REMOVE);
        } catch (Exception ignored) {
        }
        stopSelf();
    }

    private void createChannelIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || nm.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Ping in background", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Shown while a Ping run continues in the background.");
        channel.setShowBadge(false);
        nm.createNotificationChannel(channel);
    }

    private Notification buildNotification() {
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openPi = PendingIntent.getActivity(this, 0, open,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        Intent cancel = new Intent(this, PingForegroundService.class);
        cancel.setAction(ACTION_CANCEL);
        PendingIntent cancelPi = PendingIntent.getService(this, 1, cancel,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, CHANNEL_ID)
                : new Notification.Builder(this);
        builder.setSmallIcon(R.drawable.ic_stat_ping)
                .setContentTitle("iSubnet Ping")
                .setContentText("Ping is running in the background")
                .setContentIntent(openPi)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setCategory(Notification.CATEGORY_SERVICE)
                .addAction(new Notification.Action.Builder(
                        Icon.createWithResource(this, R.drawable.ic_stat_ping), "Stop", cancelPi).build());
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            builder.setPriority(Notification.PRIORITY_LOW);
        }
        return builder.build();
    }

    private void acquireWakeLock() {
        if (wakeLock != null) return;
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm == null) return;
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "iSubnet:ping");
        wakeLock.setReferenceCounted(false);
        wakeLock.acquire(WAKE_LOCK_MAX_MS);
    }

    private void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        } catch (Exception ignored) {
        }
        wakeLock = null;
    }
}
