import { Capacitor, registerPlugin } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

type NativeEvent = { id: number; at: number; title: string; body: string; silent: -1 | 0 | 1 };
type FocusPlugin = {
  hasAccess(): Promise<{ granted: boolean }>;
  openAccessSettings(): Promise<void>;
  setSilent(o: { on: boolean }): Promise<void>;
  setBars(o: { blackout: boolean }): Promise<void>;
  schedule(o: { events: NativeEvent[] }): Promise<void>;
  cancel(): Promise<void>;
  guardStatus(): Promise<{ available: boolean; serviceEnabled: boolean; on: boolean }>;
  openAccessibilitySettings(): Promise<void>;
  openAppInfo(): Promise<void>;
  listApps(): Promise<{ apps: { package: string; label: string }[] }>;
  setGuard(o: { on: boolean; apps: string[] }): Promise<void>;
  snooze(o: { minutes: number }): Promise<void>;
  consumeBlocked(): Promise<{ label?: string }>;
};

const Focus = registerPlugin<FocusPlugin>("Focus");
const Ocr = registerPlugin<{ pickAndRead(): Promise<{ cancelled: boolean; text: string }> }>("Ocr");

/** true solo dentro l'app Android (APK): nel browser tutto questo è disattivato. */
export const isNative = () => Capacitor.isNativePlatform();

export async function hasSilentAccess() {
  if (!isNative()) return false;
  try { return (await Focus.hasAccess()).granted; } catch { return false; }
}
export async function openSilentSettings() {
  try { await Focus.openAccessSettings(); } catch {}
}
export async function askNativeNotifications() {
  if (!isNative()) return;
  try { await LocalNotifications.requestPermissions(); } catch {}
}
export async function setSilent(on: boolean) {
  if (!isNative()) return;
  try { await Focus.setSilent({ on }); } catch {}
}
export async function cancelNative() {
  if (!isNative()) return;
  try { await Focus.cancel(); } catch {}
}

/**
 * Programma gli avvisi di Android per i prossimi cicli: a fine blocco torna la modalità normale
 * (e suona), a fine pausa suona e si rimette il silenzioso per il nuovo blocco.
 */
export async function scheduleNative(phase: "work" | "break", endAt: number, work: number, rest: number) {
  if (!isNative()) return;
  const events: NativeEvent[] = [];
  let at = endAt;
  let p = phase;
  for (let i = 1; i <= 12; i++) {
    if (p === "work") {
      events.push({ id: i, at, title: "Blocco completato", body: `Pausa di ${rest} minuti: alzati e muoviti un po’.`, silent: 0 });
      at += rest * 60000;
      p = "break";
    } else {
      events.push({ id: i, at, title: "Pausa finita", body: "Si riparte: un compito alla volta.", silent: 1 });
      at += work * 60000;
      p = "work";
    }
  }
  try { await Focus.schedule({ events }); } catch {}
}

/** Un solo avviso, all'orario esatto di fine fase (suona anche con lo schermo spento). Dopo non parte nulla da solo. */
export async function scheduleOne(phase: "work" | "break", endAt: number) {
  if (!isNative()) return;
  const ev: NativeEvent = phase === "work"
    ? { id: 1, at: endAt, title: "Blocco finito", body: "Tocca per continuare.", silent: 0 }
    : { id: 1, at: endAt, title: "Pausa finita", body: "Tocca per continuare.", silent: -1 };
  try { await Focus.schedule({ events: [ev] }); } catch {}
}

/** Android: sceglie uno screenshot e ne legge il testo con il riconoscimento del sistema. null se annullato. */
export async function pickAndReadImage(): Promise<string | null> {
  const r = await Ocr.pickAndRead();
  return r.cancelled ? null : r.text;
}

// ---- Blocco distrazioni ----

/** App tipiche di distrazione: preselezionate se installate. */
export const SUGGESTED_BLOCKED = [
  "com.whatsapp", "com.whatsapp.w4b", "com.instagram.android", "com.zhiliaoapp.musically", "com.ss.android.ugc.trill",
  "com.google.android.youtube", "com.snapchat.android", "org.telegram.messenger", "com.discord",
  "com.facebook.katana", "com.facebook.orca", "com.twitter.android", "tv.twitch.android.app",
  "com.reddit.frontpage", "com.pinterest", "com.netflix.mediaclient", "com.instagram.barcelona"
];

export async function guardStatus() {
  if (!isNative()) return { available: false, serviceEnabled: false, on: false };
  try { return await Focus.guardStatus(); } catch { return { available: false, serviceEnabled: false, on: false }; }
}
export async function openAccessibilitySettings() { try { await Focus.openAccessibilitySettings(); } catch {} }
export async function openAppInfo() { try { await Focus.openAppInfo(); } catch {} }
export async function listApps() {
  if (!isNative()) return [];
  try { return (await Focus.listApps()).apps; } catch { return []; }
}
export async function setGuard(on: boolean, apps: string[]) {
  if (!isNative()) return;
  try { await Focus.setGuard({ on, apps }); } catch {}
}
export async function snoozeGuard(minutes: number) {
  if (!isNative()) return;
  try { await Focus.snooze({ minutes }); } catch {}
}
/** Nome dell'app bloccata più di recente (e la dimentica), oppure null. */
export async function consumeBlocked(): Promise<string | null> {
  if (!isNative()) return null;
  try { return (await Focus.consumeBlocked()).label ?? null; } catch { return null; }
}

/** Barre di stato e di navigazione nere; con blackout anche icone e testo neri (schermo "spento"). */
export async function setBars(blackout: boolean) {
  if (!isNative()) return;
  try { await Focus.setBars({ blackout }); } catch {}
}

/** Colora la barra di stato di Android in base al tema. */
export async function setStatusBar(dark: boolean, color?: string) {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    await StatusBar.setBackgroundColor({ color: color ?? (dark ? "#0b1721" : "#f2f6f5") });
  } catch {}
}
