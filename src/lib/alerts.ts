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
    void preload("start");
    void preload("rest");
  } catch {}
}

const SOUND_URL = { start: "/sounds/sound_focus.wav", rest: "/sounds/sound_break.wav" } as const;
const buffers: Partial<Record<"start" | "rest", AudioBuffer>> = {};

async function preload(kind: "start" | "rest") {
  if (!ctx || buffers[kind]) return;
  try {
    const res = await fetch(SOUND_URL[kind]);
    buffers[kind] = await ctx.decodeAudioData(await res.arrayBuffer());
  } catch {}
}

/** Due suoni distinti: "start" = inizio attività (campanelli che salgono), "rest" = inizio pausa (toni morbidi che scendono). */
export function chime(kind: "start" | "rest") {
  if (!ctx) return;
  const buffer = buffers[kind];
  if (!buffer) { void preload(kind); return; }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start();
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
