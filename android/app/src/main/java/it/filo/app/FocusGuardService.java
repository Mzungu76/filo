package it.filo.app;

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.accessibility.AccessibilityEvent;

import java.util.HashSet;
import java.util.Set;

/**
 * Durante un blocco di studio, se si apre una delle app scelte dall'utente riporta subito a Filo.
 * Non legge il contenuto dello schermo: riceve solo il nome dell'app che passa in primo piano.
 */
public class FocusGuardService extends AccessibilityService {
    private static final long FOCUS_MAX_AGE_MS = 45 * 60 * 1000L; // sicurezza: se Filo non conferma, il blocco scade

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || event.getPackageName() == null) return;
        if (event.getEventType() != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return;
        String pkg = event.getPackageName().toString();
        if (pkg.equals(getPackageName())) return;

        SharedPreferences prefs = getSharedPreferences("filo-focus", MODE_PRIVATE);
        long now = System.currentTimeMillis();
        if (!prefs.getBoolean("guard_on", false) || !prefs.getBoolean("focus_on", false)) return;
        if (now - prefs.getLong("focus_set_at", 0) > FOCUS_MAX_AGE_MS) return;
        if (now < prefs.getLong("snooze_until", 0)) return;
        Set<String> blocked = prefs.getStringSet("blocked", new HashSet<String>());
        if (!blocked.contains(pkg)) return;

        prefs.edit().putString("last_blocked", pkg).apply();
        Intent back = new Intent(this, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(back);
    }

    @Override
    public void onInterrupt() { }
}
