package it.filo.app;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@CapacitorPlugin(name = "Focus")
public class FocusPlugin extends Plugin {
    private static final String PREFS = "filo-focus";

    private PendingIntent pending(int id, Intent intent) {
        return PendingIntent.getBroadcast(getContext(), id, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private Intent base() {
        return new Intent(getContext(), FocusReceiver.class).setAction(FocusReceiver.ACTION);
    }

    @PluginMethod
    public void hasAccess(PluginCall call) {
        NotificationManager nm = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        JSObject ret = new JSObject();
        ret.put("granted", nm != null && nm.isNotificationPolicyAccessGranted());
        call.resolve(ret);
    }

    @PluginMethod
    public void openAccessSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void setSilent(PluginCall call) {
        FocusReceiver.applySilent(getContext(), Boolean.TRUE.equals(call.getBoolean("on", false)));
        call.resolve();
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        cancelAll();
        AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
        JSArray events = call.getArray("events");
        Set<String> ids = new HashSet<>();
        try {
            for (int i = 0; events != null && i < events.length(); i++) {
                JSONObject e = events.getJSONObject(i);
                int id = e.getInt("id");
                long at = e.getLong("at");
                Intent intent = base()
                        .putExtra("id", id)
                        .putExtra("title", e.optString("title"))
                        .putExtra("body", e.optString("body"))
                        .putExtra("silent", e.optInt("silent", -1));
                PendingIntent pi = pending(id, intent);
                boolean exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms();
                if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                ids.add(String.valueOf(id));
            }
        } catch (Exception ex) {
            call.reject("Impossibile programmare gli avvisi", ex);
            return;
        }
        getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putStringSet("alarms", ids).apply();
        call.resolve();
    }

    // ---- Blocco distrazioni (servizio di accessibilità) ----

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private boolean guardServiceEnabled() {
        String enabled = Settings.Secure.getString(getContext().getContentResolver(), Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        if (enabled == null) return false;
        ComponentName me = new ComponentName(getContext(), FocusGuardService.class);
        for (String item : enabled.split(":")) {
            ComponentName c = ComponentName.unflattenFromString(item);
            if (me.equals(c)) return true;
        }
        return false;
    }

    @PluginMethod
    public void guardStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("serviceEnabled", guardServiceEnabled());
        ret.put("on", prefs().getBoolean("guard_on", false));
        call.resolve(ret);
    }

    @PluginMethod
    public void openAccessibilitySettings(PluginCall call) {
        getContext().startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        call.resolve();
    }

    @PluginMethod
    public void openAppInfo(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                .setData(android.net.Uri.parse("package:" + getContext().getPackageName()))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void listApps(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        Intent main = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        List<ResolveInfo> found = pm.queryIntentActivities(main, 0);
        JSArray apps = new JSArray();
        Set<String> seen = new HashSet<>();
        for (ResolveInfo info : found) {
            String pkg = info.activityInfo.packageName;
            if (pkg.equals(getContext().getPackageName()) || !seen.add(pkg)) continue;
            JSObject app = new JSObject();
            app.put("package", pkg);
            app.put("label", info.loadLabel(pm).toString());
            apps.put(app);
        }
        JSObject ret = new JSObject();
        ret.put("apps", apps);
        call.resolve(ret);
    }

    @PluginMethod
    public void setGuard(PluginCall call) {
        Set<String> blocked = new HashSet<>();
        JSArray list = call.getArray("apps");
        try {
            for (int i = 0; list != null && i < list.length(); i++) blocked.add(list.getString(i));
        } catch (Exception ignored) { }
        prefs().edit()
                .putBoolean("guard_on", Boolean.TRUE.equals(call.getBoolean("on", false)))
                .putStringSet("blocked", blocked)
                .apply();
        call.resolve();
    }

    @PluginMethod
    public void snooze(PluginCall call) {
        int minutes = call.getInt("minutes", 2);
        prefs().edit().putLong("snooze_until", System.currentTimeMillis() + minutes * 60000L).apply();
        call.resolve();
    }

    @PluginMethod
    public void consumeBlocked(PluginCall call) {
        String pkg = prefs().getString("last_blocked", null);
        JSObject ret = new JSObject();
        if (pkg != null) {
            prefs().edit().remove("last_blocked").apply();
            String label = pkg;
            try {
                PackageManager pm = getContext().getPackageManager();
                label = pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString();
            } catch (Exception ignored) { }
            ret.put("label", label);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        cancelAll();
        call.resolve();
    }

    private void cancelAll() {
        AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        for (String id : prefs.getStringSet("alarms", new HashSet<String>())) {
            am.cancel(pending(Integer.parseInt(id), base()));
        }
        prefs.edit().remove("alarms").apply();
    }
}
