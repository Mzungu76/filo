package it.filo.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;

import androidx.core.app.NotificationCompat;

/**
 * Scatta all'orario esatto di fine blocco / fine pausa anche con l'app chiusa e lo schermo spento:
 * regola "Non disturbare", mostra la notifica con suono e vibrazione.
 */
public class FocusReceiver extends BroadcastReceiver {
    static final String ACTION = "it.filo.app.FOCUS_EVENT";
    static final String CHANNEL = "filo-alerts";
    private static final String PREFS = "filo-focus";

    /** Attiva (true) o ripristina (false) il non disturbare. Ricorda lo stato precedente dell'utente. */
    static void applySilent(Context ctx, boolean on) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || !nm.isNotificationPolicyAccessGranted()) return;
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (on) {
            if (!prefs.getBoolean("active", false)) {
                prefs.edit().putBoolean("active", true).putInt("previous", nm.getCurrentInterruptionFilter()).apply();
            }
            nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_PRIORITY);
        } else if (prefs.getBoolean("active", false)) {
            int previous = prefs.getInt("previous", NotificationManager.INTERRUPTION_FILTER_ALL);
            nm.setInterruptionFilter(previous == NotificationManager.INTERRUPTION_FILTER_UNKNOWN
                    ? NotificationManager.INTERRUPTION_FILTER_ALL : previous);
            prefs.edit().putBoolean("active", false).apply();
        }
    }

    static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm.getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL, "Avvisi di Filo", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Fine blocco, fine pausa e orario di inizio");
        channel.enableVibration(true);
        nm.createNotificationChannel(channel);
    }

    @Override
    public void onReceive(final Context ctx, Intent intent) {
        final PendingResult result = goAsync();
        int id = intent.getIntExtra("id", 0);
        String title = intent.getStringExtra("title");
        String body = intent.getStringExtra("body");
        int silent = intent.getIntExtra("silent", -1);

        // Se si torna alla modalità normale, lo si fa prima: così la notifica suona.
        if (silent == 0) applySilent(ctx, false);

        ensureChannel(ctx);
        Intent open = new Intent(ctx, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent content = PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, CHANNEL)
                .setSmallIcon(ctx.getApplicationInfo().icon)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setAutoCancel(true)
                .setContentIntent(content);
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        try { nm.notify(id, builder.build()); } catch (SecurityException ignored) { }

        try {
            Vibrator vibrator = (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) vibrator.vibrate(VibrationEffect.createWaveform(new long[]{0, 250, 120, 250}, -1));
                else vibrator.vibrate(new long[]{0, 250, 120, 250}, -1);
            }
        } catch (Exception ignored) { }

        if (silent == 1) {
            // Lascia il tempo al suono di partire, poi rimette il silenzioso per il nuovo blocco.
            new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
                @Override public void run() {
                    applySilent(ctx, true);
                    result.finish();
                }
            }, 4000);
        } else {
            result.finish();
        }
    }
}
