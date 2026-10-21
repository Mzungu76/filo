"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { askNativeNotifications, hasSilentAccess, isNative, openSilentSettings, scheduleOne, cancelNative, setSilent, setStatusBar } from "@/lib/native";
import { chime, keepAwake, unlockAudio, vibrate } from "@/lib/alerts";

// filò (nero): nessuna distrazione. Si sceglie un tempo, si preme Avvia e lo schermo diventa nero.
// Tre tocchi ripetuti mostrano il cerchio per qualche secondo; allo scadere suona e compaiono i "+1".

type Preset = { work: number; rest: number };
const DEFAULTS: Preset[] = [{ work: 15, rest: 5 }, { work: 25, rest: 5 }, { work: 45, rest: 10 }];
const KEY = "filo-mono-presets", KEY_SEL = "filo-mono-sel";

type Screen = "setup" | "running" | "expired";
type Phase = "work" | "break";

function fmt(sec: number) {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Ring({ value, children }: { value: number; children: React.ReactNode }) {
  const R = 118, C = 2 * Math.PI * R, v = Math.min(1, Math.max(0, value));
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const a = (i / 60) * Math.PI * 2, major = i % 5 === 0, r1 = major ? 100 : 106, r2 = 112;
    return <line key={i} x1={150 + r1 * Math.sin(a)} y1={150 - r1 * Math.cos(a)} x2={150 + r2 * Math.sin(a)} y2={150 - r2 * Math.cos(a)} strokeWidth={major ? 1.8 : 0.8}/>;
  });
  return (
    <div className="m-ring">
      <svg viewBox="0 0 300 300" aria-hidden="true">
        <circle cx="150" cy="150" r="140" fill="none" strokeWidth="1"/>
        <g stroke="currentColor" opacity=".55">{ticks}</g>
        <circle cx="150" cy="150" r={R + 12} fill="none" stroke="currentColor" opacity=".25" strokeWidth="1"/>
        <circle cx="150" cy="150" r={R + 12} fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="butt"
          strokeDasharray={2 * Math.PI * (R + 12)} strokeDashoffset={2 * Math.PI * (R + 12) * (1 - v)} transform="rotate(-90 150 150)"/>
        <circle cx="150" cy="150" r="140" fill="none" stroke="currentColor" opacity=".35" strokeWidth="1" strokeDasharray={C > 0 ? "1 7" : undefined}/>
      </svg>
      <div className="m-ring-in">{children}</div>
    </div>
  );
}

export default function MonoApp() {
  const [presets, setPresets] = useState<Preset[]>(DEFAULTS);
  const [sel, setSel] = useState(1);
  const [screen, setScreen] = useState<Screen>("setup");
  const [phase, setPhase] = useState<Phase>("work");
  const [endAt, setEndAt] = useState(0);
  const [total, setTotal] = useState(1);
  const [now, setNow] = useState(Date.now());
  const [extra, setExtra] = useState(0);
  const [reveal, setReveal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Preset>({ work: 30, rest: 5 });
  const [silentOk, setSilentOk] = useState(true);
  const native = typeof window !== "undefined" && isNative();
  const taps = useRef<number[]>([]);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "null");
      if (Array.isArray(raw) && raw.length) setPresets(raw);
      const saved = localStorage.getItem(KEY_SEL);
      if (saved !== null && Number.isFinite(Number(saved))) setSel(Number(saved));
    } catch {}
    void setStatusBar(true, "#000000");
    if (isNative()) {
      const check = () => void hasSilentAccess().then(setSilentOk);
      check();
      document.addEventListener("visibilitychange", check);
      return () => document.removeEventListener("visibilitychange", check);
    }
  }, []);

  const save = (list: Preset[], s = sel) => {
    setPresets(list); setSel(s);
    try { localStorage.setItem(KEY, JSON.stringify(list)); localStorage.setItem(KEY_SEL, String(s)); } catch {}
  };
  const cur = presets[Math.min(sel, presets.length - 1)];

  const expire = useCallback(() => {
    setScreen("expired");
    setExtra(0);
    setReveal(false);
    void setSilent(false);
    if (!isNative()) { chime(phase === "work" ? "rest" : "start"); vibrate(); }
  }, [phase]);

  // Orologio: controlla la scadenza anche al ritorno nell'app.
  useEffect(() => {
    if (screen !== "running") return;
    const tick = () => { const t = Date.now(); setNow(t); if (t >= endAt) expire(); };
    const id = setInterval(tick, 500);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", tick); };
  }, [screen, endAt, expire]);

  const begin = (p: Phase, minutes: number) => {
    const t = Date.now();
    setPhase(p); setTotal(minutes * 60); setEndAt(t + minutes * 60000); setNow(t); setReveal(false); setScreen("running");
    void setSilent(p === "work");
    void scheduleOne(p, t + minutes * 60000);
    keepAwake(true);
  };

  const start = () => {
    unlockAudio();
    if (isNative()) { void askNativeNotifications(); void hasSilentAccess().then(setSilentOk); }
    begin("work", cur.work);
  };
  const next = () => {
    unlockAudio();
    if (extra > 0) begin(phase, extra);
    else if (phase === "work") begin("break", cur.rest);
    else begin("work", cur.work);
  };
  const stop = () => {
    void setSilent(false); void cancelNative(); keepAwake(false);
    setScreen("setup"); setReveal(false);
  };

  const onBlackTap = () => {
    const t = Date.now();
    taps.current = [...taps.current.filter((x) => t - x < 700), t];
    if (taps.current.length >= 3) {
      taps.current = [];
      setReveal(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setReveal(false), 6000);
    }
  };

  const remaining = Math.max(0, (endAt - now) / 1000);
  const nextLabel = extra > 0 ? `Ancora ${extra} min` : phase === "work" ? `Pausa · ${fmt(cur.rest * 60)}` : `Studio · ${fmt(cur.work * 60)}`;

  if (screen === "running") {
    return (
      <div className="mono black" onPointerDown={onBlackTap}>
        {reveal && (
          <div className="m-reveal">
            <Ring value={remaining / total}>
              <i className="m-phase">{phase === "work" ? "studio" : "pausa"}</i>
              <b className="m-time">{fmt(remaining)}</b>
            </Ring>
            <button className="m-link" onPointerDown={(e) => e.stopPropagation()} onClick={stop}>interrompi</button>
          </div>
        )}
      </div>
    );
  }

  if (screen === "expired") {
    return (
      <div className="mono">
        <div className="m-center">
          <Ring value={0}>
            <i className="m-phase">{phase === "work" ? "fine blocco" : "fine pausa"}</i>
            <b className="m-time">+{extra}</b>
            <i className="m-phase">minuti in più</i>
          </Ring>
          <button className="m-plus" onClick={() => setExtra((n) => n + 1)} aria-label="Aggiungi un minuto">+1</button>
        </div>
        <div className="m-foot">
          <button className="m-go" onClick={next}>{nextLabel}</button>
          <button className="m-link" onClick={stop}>concludi</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mono">
      <h1 className="m-title">Filò</h1>
      <div className="m-orn"/>
      <div className="m-list" role="radiogroup" aria-label="Tempi">
        {presets.map((p, i) => (
          <div key={i} className={i === sel ? "m-row on" : "m-row"}>
            <button role="radio" aria-checked={i === sel} onClick={() => save(presets, i)}><span>{p.work} · {p.rest}</span><small>minuti</small></button>
            {presets.length > 1 && <button className="m-x" aria-label="Elimina questo tempo" onClick={() => { const l = presets.filter((_, k) => k !== i); save(l, Math.min(sel > i ? sel - 1 : sel, l.length - 1)); }}>×</button>}
          </div>
        ))}
        {editing ? (
          <div className="m-edit">
            {([["Studio", "work"], ["Pausa", "rest"]] as const).map(([label, k]) => (
              <div className="m-step" key={k}>
                <span>{label}</span>
                <button onClick={() => setDraft((d) => ({ ...d, [k]: Math.max(1, d[k] - 1) }))} aria-label={`${label} meno`}>−</button>
                <b>{draft[k]}</b>
                <button onClick={() => setDraft((d) => ({ ...d, [k]: Math.min(180, d[k] + 1) }))} aria-label={`${label} più`}>+</button>
              </div>
            ))}
            <div className="m-edit-go">
              <button onClick={() => setEditing(false)}>annulla</button>
              <button className="solid" onClick={() => { const l = [...presets, draft]; save(l, l.length - 1); setEditing(false); }}>salva</button>
            </div>
          </div>
        ) : (
          <button className="m-add" onClick={() => setEditing(true)}>aggiungi un tempo</button>
        )}
      </div>
      {native && !silentOk && <button className="m-link warn" onClick={() => void openSilentSettings()}>attiva il blocco notifiche ›</button>}
      <button className="m-go bottom" onClick={start}>Avvia</button>
    </div>
  );
}
