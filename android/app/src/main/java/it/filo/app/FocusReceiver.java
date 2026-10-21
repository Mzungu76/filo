package it.filo.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
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
    static final String CHANNEL = "filo-alerts-v2";
    private static final String PREFS = "filo-focus";

    /** Attiva (true) o ripristina (false) il non disturbare. Ricorda lo stato precedente dell'utente. */
    static void applySilent(Context ctx, boolean on) {
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        // Anche il blocco delle altre app segue lo stato "concentrazione"; scade da solo (vedi FocusGuardService).
        prefs.edit().putBoolean("focus_on", on).putLong("focus_set_at", System.currentTimeMillis()).apply();
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || !nm.isNotificationPolicyAccessGranted()) return;
        if (on) {
            if (!prefs.getBoolean("active", false)) {
                prefs.edit().putBoolean("active", true).putInt("previous", nm.getCurrentInterruptionFilter()).apply();
            }
            nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALARMS);
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
        // Il canale precedente (con suono di sistema) viene sostituito: suono e vibrazione li produciamo noi.
        nm.deleteNotificationChannel("filo-alerts");
        if (nm.getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL, "Avvisi di Filo", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Fine blocco, fine pausa e orario di inizio");
        channel.setSound(null, null);
        channel.enableVibration(false);
        nm.createNotificationChannel(channel);
    }

    private static AudioAttributes alarmAttributes() {
        // Come una sveglia: il non disturbare "prioritario" la lascia passare, e non dipende dall'ordine con cui cambia la modalità.
        return new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
    }

    /** Suona uno dei due suoni di Filo (inizio attività / inizio pausa) con le caratteristiche di una sveglia. */
    private static void playSound(Context ctx, int rawRes) {
        try {
            MediaPlayer player = MediaPlayer.create(ctx, rawRes, alarmAttributes(), AudioManager.AUDIO_SESSION_ID_GENERATE);
            if (player == null) return;
            player.setOnCompletionListener(new MediaPlayer.OnCompletionListener() {
                @Override public void onCompletion(MediaPlayer mp) { mp.release(); }
            });
            player.start();
        } catch (Exception ignored) { }
    }

    @SuppressWarnings("deprecation")
    private static void buzz(Context ctx) {
        try {
            Vibrator vibrator = (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator == null || !vibrator.hasVibrator()) return;
            long[] pattern = new long[]{0, 300, 150, 300, 150, 300};
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1), alarmAttributes());
            } else {
                vibrator.vibrate(pattern, -1, alarmAttributes());
            }
        } catch (Exception ignored) { }
    }

    @Override
    public void onReceive(final Context ctx, Intent intent) {
        final PendingResult result = goAsync();
        int id = intent.getIntExtra("id", 0);
        String title = intent.getStringExtra("title");
        String body = intent.getStringExtra("body");
        final int silent = intent.getIntExtra("silent", -1);

        // Fine blocco: si toglie il silenzioso (il cambio è asincrono, ma il suono "da sveglia" non ne dipende).
        if (silent == 0) applySilent(ctx, false);

        // silent == 0: finisce il blocco, inizia la pausa. Altrimenti inizia un'attività.
        playSound(ctx, silent == 0 ? R.raw.sound_break : R.raw.sound_focus);
        buzz(ctx);

        ensureChannel(ctx);
        Intent open = new Intent(ctx, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent content = PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_filo)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setSilent(true)
                .setAutoCancel(true)
                .setContentIntent(content);
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        try { nm.notify(id, builder.build()); } catch (SecurityException ignored) { }

        // Lascia il tempo a suono e vibrazione; a fine pausa poi rimette il silenzioso per il nuovo blocco.
        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override public void run() {
                if (silent == 1) applySilent(ctx, true);
                result.finish();
            }
        }, 4000);
    }
}
