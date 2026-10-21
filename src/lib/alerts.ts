let ctx: AudioContext | null = null;
let lock: WakeLockSentinel | null = null;
let wantAwake = false;

/** I browser permettono l'audio solo dopo un tocco: da chiamare dentro un click. */
export function unlockAudio() {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx = ctx ?? new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {}
}

/** Breve melodia: "start" sale (si riparte), "rest" scende (pausa). */
export function chime(kind: "start" | "rest") {
  if (!ctx) return;
  const notes = kind === "start" ? [523, 659, 784] : [784, 659, 523];
  notes.forEach((freq, i) => {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    const t = ctx!.currentTime + i * 0.28;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    osc.connect(gain).connect(ctx!.destination);
    osc.start(t);
    osc.stop(t + 0.55);
  });
}

export function vibrate() {
  try { navigator.vibrate?.([200, 100, 200]); } catch {}
}

export function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function askNotificationPermission() {
  if (!notificationsSupported() || Notification.permission !== "default") return;
  try { await Notification.requestPermission(); } catch {}
}

export async function notify(title: string, body: string) {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, icon: "/icon-192.png", tag: "filo" });
    else new Notification(title, { body, icon: "/icon-192.png" });
  } catch {}
}

async function acquire() {
  try {
    if (wantAwake && !lock && "wakeLock" in navigator) {
      lock = await navigator.wakeLock.request("screen");
      lock.addEventListener("release", () => { lock = null; });
    }
  } catch {}
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void acquire(); });
}

/** Tiene lo schermo acceso mentre il timer gira, così gli avvisi arrivano. */
export function keepAwake(on: boolean) {
  wantAwake = on;
  if (on) void acquire();
  else { void lock?.release(); lock = null; }
}
