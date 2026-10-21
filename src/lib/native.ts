import { Capacitor, registerPlugin } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

type NativeEvent = { id: number; at: number; title: string; body: string; silent: -1 | 0 | 1 };
type FocusPlugin = {
  hasAccess(): Promise<{ granted: boolean }>;
  openAccessSettings(): Promise<void>;
  setSilent(o: { on: boolean }): Promise<void>;
  schedule(o: { events: NativeEvent[] }): Promise<void>;
  cancel(): Promise<void>;
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

/** Android: sceglie uno screenshot e ne legge il testo con il riconoscimento del sistema. null se annullato. */
export async function pickAndReadImage(): Promise<string | null> {
  const r = await Ocr.pickAndRead();
  return r.cancelled ? null : r.text;
}
