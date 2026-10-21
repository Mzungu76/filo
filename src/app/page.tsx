"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ClipboardPaste, Coffee, Download, ImageUp, Settings2, ListTodo, Pause, Play, Plus, Square, Trash2, X } from "lucide-react";
import { getSessions, getSetting, getTasks, removeTask, saveSession, saveTask, setSetting, type StudySession, type Task } from "@/lib/db";
import { parseDidup } from "@/lib/didup";
import { readImageText } from "@/lib/ocr";
import { askNotificationPermission, chime, keepAwake, notificationsSupported, notify, unlockAudio, vibrate } from "@/lib/alerts";
import { useInstall } from "@/lib/install";
import { advance as stepTimer } from "@/lib/timer";
import { askNativeNotifications, cancelNative, hasSilentAccess, isNative, openSilentSettings, scheduleNative, setSilent } from "@/lib/native";
import { LEVELS, planFor, type Plan, type Preset } from "@/lib/workload";

type Mode = "idle" | "work" | "break" | "paused";

// Programma suggerito: blocchi brevi con pausa, un compito alla volta. Le durate dipendono dal preset.
const DEFAULT_START = "16:30";
const DAY = 24 * 3600 * 1000;

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function formatTime(seconds: number) {
  const m = Math.floor(Math.max(0, seconds) / 60).toString().padStart(2, "0");
  const s = Math.max(0, seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function weekStart(ts: number) {
  const d = new Date(startOfDay(ts));
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}
function dueLabel(due: number | undefined, now: number) {
  if (due === undefined) return "Senza scadenza";
  const diff = Math.round((due - startOfDay(now)) / DAY);
  const date = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" }).format(due);
  if (diff < 0) return `Scaduto · ${date}`;
  if (diff === 0) return `Per oggi · ${date}`;
  if (diff === 1) return `Per domani · ${date}`;
  return `Per ${date}`;
}
function byDue(a: Task, b: Task) {
  return (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity) || a.createdAt - b.createdAt;
}

export default function Home() {
  const [ready, setReady] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [taskInput, setTaskInput] = useState("");
  const [mode, setMode] = useState<Mode>("idle");
  const [remaining, setRemaining] = useState(0);
  const [preset, setPreset] = useState<Preset>("auto");
  const [lockedPlan, setLockedPlan] = useState<Plan | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [endAt, setEndAt] = useState<number | null>(null);
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [workSeconds, setWorkSeconds] = useState(0);
  const [notice, setNotice] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [skipped, setSkipped] = useState<number[]>([]);
  const [reading, setReading] = useState<number | null>(null);
  const [alertsOn, setAlertsOn] = useState(true);
  const [startTime, setStartTime] = useState(DEFAULT_START);
  const [advance, setAdvance] = useState<Task | null>(null);
  const install = useInstall();
  const [native, setNative] = useState(false);
  const [silentOk, setSilentOk] = useState(false);
  const lastTickRef = useRef(0);
  const alertRef = useRef<(title: string, body: string, kind: "start" | "rest") => void>(() => {});
  const remindedRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const livePlan = useMemo(() => planFor(preset, tasks), [preset, tasks]);
  const plan = lockedPlan ?? livePlan;
  const open = useMemo(() => tasks.filter((t) => t.status === "todo").sort(byDue), [tasks]);

  const refresh = useCallback(async () => {
    const [nextTasks, nextSessions, savedPreset, savedAlerts, savedStart] = await Promise.all([
      getTasks(), getSessions(), getSetting<Preset>("preset", "auto"),
      getSetting("alerts", true), getSetting("startTime", DEFAULT_START)
    ]);
    setPreset(savedPreset);
    setAlertsOn(savedAlerts);
    setStartTime(savedStart);
    setTasks(nextTasks);
    setSessions(nextSessions);
    setReady(true);
  }, []);

  useEffect(() => {
    refresh().catch(() => setReady(true));
    setNative(isNative());
    if ("serviceWorker" in navigator && !isNative()) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, [refresh]);

  // Suono e vibrazione sempre; notifica solo se l'app non è in primo piano.
  alertRef.current = (title, body, kind) => {
    // Nell'app Android gli avvisi li gestisce il sistema (suonano anche a schermo spento).
    if (!alertsOn || isNative()) return;
    chime(kind);
    vibrate();
    if (document.hidden) void notify(title, body);
  };

  useEffect(() => { keepAwake(mode === "work" || mode === "break"); }, [mode]);

  // Promemoria all'orario di inizio (funziona finché Filo è aperto).
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      const key = `${d.toDateString()} ${startTime}`;
      const hhmm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      if (hhmm === startTime && remindedRef.current !== key && mode === "idle" && open.length > 0) {
        remindedRef.current = key;
        alertRef.current("È ora di iniziare", `Hai ${open.length} ${open.length === 1 ? "compito" : "compiti"} da fare. Un passo alla volta.`, "start");
        setNotice("È ora di iniziare i compiti.");
      }
    }, 20000);
    return () => clearInterval(id);
  }, [startTime, mode, open]);

  // Silenzioso: controlla (e ricontrolla al ritorno nell'app) il permesso "Non disturbare".
  useEffect(() => {
    if (!native) return;
    const check = () => { void hasSilentAccess().then(setSilentOk); };
    check();
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, [native]);

  useEffect(() => {
    if ((mode !== "work" && mode !== "break") || !endAt) return;
    const tick = () => {
      const t = Date.now();
      // Se l'app è rimasta sospesa, recupera tutte le fasi trascorse (blocco → pausa → blocco…).
      const r = stepTimer(mode, endAt, lastTickRef.current, t, plan);
      lastTickRef.current = t;
      if (r.workMs > 0) setWorkSeconds((v) => v + r.workMs / 1000);
      setRemaining(Math.max(0, Math.ceil((r.endAt - t) / 1000)));
      if (r.crossed > 0) {
        setMode(r.phase);
        setEndAt(r.endAt);
        void setSilent(r.phase === "work");
        if (r.phase === "break") {
          setNotice(`Blocco completato. Pausa di ${plan.rest} minuti: alzati e muoviti un po’.`);
          alertRef.current("Blocco completato", `Pausa di ${plan.rest} minuti.`, "rest");
        } else {
          setNotice("Pausa finita: si riparte. Un compito alla volta.");
          alertRef.current("Pausa finita", "Si riparte: un compito alla volta.", "start");
        }
      }
    };
    timerRef.current = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [mode, endAt, plan]);

  const now = Date.now();
  const doneToday = useMemo(
    () => tasks.filter((t) => t.status === "done" && t.completedAt && t.completedAt >= startOfDay(Date.now())),
    [tasks]
  );
  const groups = useMemo(() => {
    const map = new Map<number, Task[]>();
    for (const t of open) {
      const key = t.dueDate ?? -1;
      map.set(key, [...(map.get(key) ?? []), t]);
    }
    return Array.from(map.entries());
  }, [open]);
  const current = open.find((t) => t.id === focusId) ?? open[0];
  const todayMinutes = sessions.filter((s) => s.startedAt >= startOfDay(now)).reduce((sum, s) => sum + s.workMinutes, 0);
  const weekMinutes = sessions.filter((s) => s.startedAt >= weekStart(now)).reduce((sum, s) => sum + s.workMinutes, 0);

  const preview = useMemo(() => parseDidup(importText), [importText]);
  const toAdd = preview.filter((_, i) => !skipped.includes(i));

  const timerLabel = mode === "break" ? "PAUSA" : mode === "paused" ? "IN PAUSA" : mode === "work" ? "FOCUS" : "PRONTO";
  const total = (mode === "break" ? plan.rest : plan.work) * 60;
  const shown = mode === "idle" ? plan.work * 60 : remaining;
  const progress = mode === "idle" || mode === "paused" ? 0 : 1 - remaining / total;

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const title = taskInput.trim();
    if (!title) return;
    await saveTask({ id: uid(), title, status: "todo", createdAt: Date.now() });
    setTaskInput("");
    await refresh();
  }

  async function importTasks() {
    const base = Date.now();
    const existing = new Set(open.map((t) => `${t.title}|${t.dueDate ?? ""}`));
    const fresh = toAdd.filter((p) => !existing.has(`${p.title}|${p.dueDate ?? ""}`));
    await Promise.all(fresh.map((p, i) => saveTask({
      id: uid(), title: p.title, subject: p.subject, dueDate: p.dueDate, status: "todo", createdAt: base + i
    })));
    setImportText(""); setSkipped([]); setShowImport(false);
    setNotice(fresh.length ? `${fresh.length} compiti aggiunti.` : "Questi compiti erano già in lista.");
    await refresh();
  }

  async function pasteFromClipboard() {
    try {
      setImportText(await navigator.clipboard.readText());
      setSkipped([]);
    } catch {
      setNotice("Non riesco a leggere gli appunti: tieni premuto nel riquadro e scegli Incolla.");
    }
  }

  async function importImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setReading(0);
    try {
      const text = await readImageText(file, setReading);
      setImportText(text);
      setSkipped([]);
      if (parseDidup(text).length === 0) setNotice("Non ho trovato compiti nell'immagine. Prova con uno screenshot più nitido.");
    } catch {
      setNotice("Non sono riuscito a leggere l'immagine. Riprova, oppure incolla il testo.");
    } finally {
      setReading(null);
    }
  }

  async function toggleAlerts() {
    const next = !alertsOn;
    setAlertsOn(next);
    await setSetting("alerts", next);
    if (next) { unlockAudio(); chime("start"); await askNotificationPermission(); }
  }

  async function changeStartTime(value: string) {
    if (!value) return;
    setStartTime(value);
    await setSetting("startTime", value);
  }

  async function choosePreset(next: Preset) {
    setPreset(next);
    await setSetting("preset", next);
  }

  async function toggleTask(task: Task) {
    const next: Task = task.status === "done"
      ? { ...task, status: "todo", completedAt: undefined }
      : { ...task, status: "done", completedAt: Date.now() };
    await saveTask(next);
    await refresh();
  }

  async function deleteTask(id: string) {
    await removeTask(id);
    await refresh();
  }

  function prepareAlerts() {
    unlockAudio();
    if (isNative()) {
      void askNativeNotifications();
      void hasSilentAccess().then((ok) => {
        setSilentOk(ok);
        if (!ok) setNotice("Per il silenzioso automatico concedi l’accesso “Non disturbare” dalle impostazioni (icona in alto).");
      });
    } else if (alertsOn) void askNotificationPermission();
  }

  function startWork() {
    prepareAlerts();
    setAdvance(null);
    const start = Date.now();
    if (mode === "idle") { setSessionStart(start); setWorkSeconds(0); setLockedPlan(livePlan); }
    startBlock(lockedPlan ?? livePlan);
    setNotice("");
  }
  function startBlock(p: Plan) {
    const t = Date.now();
    const end = t + p.work * 60000;
    lastTickRef.current = t;
    setMode("work");
    setRemaining(p.work * 60);
    setEndAt(end);
    setNotice("");
    void setSilent(true);
    void scheduleNative("work", end, p.work, p.rest);
  }
  function resumeWork() { unlockAudio(); startBlock(plan); }
  function pauseTimer() {
    setMode("paused");
    setEndAt(null);
    setNotice("Timer in pausa. Puoi riprendere quando sei pronto.");
    void setSilent(false);
    void cancelNative();
  }
  function startBreak() {
    unlockAudio();
    const t = Date.now();
    const end = t + plan.rest * 60000;
    lastTickRef.current = t;
    setMode("break");
    setRemaining(plan.rest * 60);
    setEndAt(end);
    setNotice("");
    void setSilent(false);
    void scheduleNative("break", end, plan.work, plan.rest);
  }

  async function finishSession() {
    const end = Date.now();
    if (sessionStart && workSeconds > 0) {
      await saveSession({
        id: uid(), startedAt: sessionStart, endedAt: end,
        workMinutes: Math.max(1, Math.round(workSeconds / 60)),
        completedTaskIds: tasks.filter((t) => t.status === "done" && (t.completedAt || 0) >= sessionStart).map((t) => t.id)
      });
    }
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    void setSilent(false);
    void cancelNative();
    setMode("idle"); setEndAt(null); setSessionStart(null); setWorkSeconds(0);
    setLockedPlan(null);
    const tomorrow = startOfDay(end) + DAY;
    const urgent = open.filter((t) => t.dueDate === undefined || t.dueDate <= tomorrow).length;
    const later = open.find((t) => t.dueDate !== undefined && t.dueDate > tomorrow);
    setAdvance(later ?? null);
    setNotice(urgent > 0
      ? `Sessione chiusa. Restano ${urgent} ${urgent === 1 ? "compito" : "compiti"} per oggi o domani.`
      : "Sessione chiusa. Bel lavoro.");
    await refresh();
  }

  if (!ready) return <main className="loading">Filo si sta preparando…</main>;

  return (
    <main className="app-shell">
      <header className="topbar">
        <span className="brand"><span className="brand-mark">f</span><span>filo</span></span>
        <span className="top-right">
          <span className="suggested">{startTime} · {plan.work}+{plan.rest} min</span>
          <button className="icon-btn" aria-label="Impostazioni del programma" onClick={() => setShowSettings(true)}><Settings2 size={18}/></button>
        </span>
      </header>

      {install.visible && !native && (
        <div className="install-banner" role="note">
          <Download size={18}/>
          <span>
            <strong>Installa Filo sul telefono</strong>
            {install.ios
              ? " Tocca Condividi e poi “Aggiungi alla schermata Home”: si apre a schermo intero e gli avvisi funzionano meglio."
              : " Si apre a schermo intero, come un’app, e gli avvisi funzionano meglio."}
          </span>
          {!install.ios && <button className="install-go" onClick={install.install}>Installa</button>}
          <button className="install-x" aria-label="Non ora" onClick={install.dismiss}><X size={14}/></button>
        </div>
      )}

      <section className="timer-card">
        <div className="timer-top">
          <span className="pill"><span className={`status-dot ${mode}`}></span>{timerLabel}</span>
        </div>
        <p className="current-task">
          {current ? <><small>Adesso</small>{current.title}</> : <small>Aggiungi un compito per iniziare</small>}
        </p>
        <div className="timer-ring" style={{ "--progress": `${Math.min(100, Math.max(0, progress * 100))}%` } as React.CSSProperties}>
          <div className="timer-inner">
            <span className="timer-time">{formatTime(shown)}</span>
          </div>
        </div>
        <div className="timer-controls">
          {mode === "idle" ? (
            <button className="primary-btn" onClick={startWork}><Play size={17} fill="currentColor"/> Inizia</button>
          ) : mode === "work" ? (
            <>
              <button className="primary-btn" onClick={pauseTimer}><Pause size={17} fill="currentColor"/> Pausa</button>
              <button className="secondary-btn" onClick={startBreak}><Coffee size={17}/> Fai una pausa</button>
              <button className="quiet-btn" onClick={finishSession}><Square size={15}/> Chiudi sessione</button>
            </>
          ) : (
            <>
              <button className="primary-btn" onClick={resumeWork}><Play size={17} fill="currentColor"/> Riprendi</button>
              <button className="secondary-btn" onClick={finishSession}><Check size={17}/> Chiudi sessione</button>
            </>
          )}
        </div>
        {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="Chiudi avviso" onClick={() => setNotice("")}><X size={14}/></button></div>}
      </section>

      {advance && mode === "idle" && (
        <div className="advance-card" role="dialog" aria-label="Vuoi avvantaggiarti?">
          <strong>Vuoi avvantaggiarti?</strong>
          <p>Per oggi sei a posto. Il prossimo compito in scadenza è{advance.subject ? ` ${advance.subject}` : ""}: “{advance.title}” ({dueLabel(advance.dueDate, now).toLowerCase()}).</p>
          <div className="advance-actions">
            <button className="primary-btn dark" onClick={() => { setFocusId(advance.id); setAdvance(null); startWork(); }}>Sì, iniziamo</button>
            <button className="secondary-light" onClick={() => setAdvance(null)}>No, per oggi basta</button>
          </div>
        </div>
      )}

      <section className="tasks-section">
        <div className="section-heading">
          <h2>Da fare</h2>
          <button className="import-btn" onClick={() => setShowImport((v) => !v)}><ClipboardPaste size={15}/> Da DidUP</button>
        </div>

        {showImport && (
          <div className="import-box">
            <p className="field-help">In DidUP apri Diario → Compiti e fai uno screenshot: caricalo qui. In alternativa, copia il testo e incollalo.</p>
            <label className={`secondary-light upload ${reading !== null ? "busy" : ""}`}>
              <ImageUp size={15}/> {reading === null ? "Carica screenshot" : `Leggo l’immagine… ${Math.round(reading * 100)}%`}
              <input type="file" accept="image/*" onChange={importImage} disabled={reading !== null} hidden/>
            </label>
            <textarea
              value={importText}
              onChange={(e) => { setImportText(e.target.value); setSkipped([]); }}
              placeholder="…oppure incolla qui il testo dei compiti"
              aria-label="Testo dei compiti da DidUP"
              rows={5}
            />
            {!importText && <button className="secondary-light" onClick={pasteFromClipboard}><ClipboardPaste size={15}/> Incolla dagli appunti</button>}
            {preview.length > 0 && (
              <div className="preview-list">
                {preview.map((p, i) => (
                  <label className="preview-row" key={i}>
                    <input type="checkbox" checked={!skipped.includes(i)} onChange={() => setSkipped((s) => s.includes(i) ? s.filter((x) => x !== i) : [...s, i])}/>
                    <span>
                      <strong>{p.subject ?? "Compito"}</strong>{p.dueDate !== undefined && <em> · {dueLabel(p.dueDate, now).replace(/^Per |^Scaduto · /, "")}</em>}
                      <span className="preview-title">{p.title}</span>
                    </span>
                  </label>
                ))}
                <button className="primary-btn dark full-btn" disabled={toAdd.length === 0} onClick={importTasks}>
                  Aggiungi {toAdd.length} {toAdd.length === 1 ? "compito" : "compiti"}
                </button>
              </div>
            )}
          </div>
        )}

        <form className="task-form" onSubmit={addTask}>
          <input value={taskInput} onChange={(e) => setTaskInput(e.target.value)} placeholder="Aggiungi un compito…" aria-label="Nuovo compito" maxLength={200}/>
          <button type="submit" aria-label="Aggiungi compito" disabled={!taskInput.trim()}><Plus size={19}/></button>
        </form>

        {open.length === 0 ? (
          <div className="empty-state"><ListTodo size={25}/><p>Nessun compito da fare.</p><span>Importa da DidUP o aggiungine uno a mano.</span></div>
        ) : groups.map(([key, list]) => (
          <div className="task-group" key={key}>
            <p className="group-title">{dueLabel(key === -1 ? undefined : key, now)}</p>
            <div className="task-list">
              {list.map((task) => (
                <div className={`task-row ${task.id === current?.id ? "focused" : ""}`} key={task.id}>
                  <button className="check-btn" aria-label="Segna completato" onClick={() => toggleTask(task)}/>
                  <button className="task-body" onClick={() => setFocusId(task.id)} aria-label={`Lavora su: ${task.title}`}>
                    {task.subject && <span className="subject-chip">{task.subject}</span>}
                    <span className="task-title">{task.title}</span>
                  </button>
                  <button className="delete-btn" aria-label="Elimina compito" onClick={() => deleteTask(task.id)}><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {doneToday.length > 0 && (
          <div className="task-group">
            <p className="group-title">Fatti oggi</p>
            <div className="task-list">
              {doneToday.map((task) => (
                <div className="task-row completed" key={task.id}>
                  <button className="check-btn" aria-label="Segna da fare" onClick={() => toggleTask(task)}><Check size={16}/></button>
                  <span className="task-body"><span className="task-title">{task.title}</span></span>
                  <button className="delete-btn" aria-label="Elimina compito" onClick={() => deleteTask(task.id)}><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="bottom-stats">
        <div><div><strong>{todayMinutes} min</strong><span>studio oggi</span></div></div>
        <div><div><strong>{weekMinutes} min</strong><span>questa settimana</span></div></div>
      </section>
      <p className="privacy-note">I tuoi dati restano su questo dispositivo. Nessun account.</p>

      {showSettings && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}>
          <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <div className="modal-head">
              <div><p className="eyebrow">PROGRAMMA</p><h2 id="settings-title">Quanto lavoro hai oggi?</h2></div>
              <button className="icon-btn" onClick={() => setShowSettings(false)} aria-label="Chiudi"><X size={18}/></button>
            </div>
            <div className="preset-list" role="radiogroup" aria-label="Quantità di compiti">
              <button role="radio" aria-checked={preset === "auto"} className={preset === "auto" ? "preset on" : "preset"} onClick={() => choosePreset("auto")}>
                <strong>Automatico</strong>
                <span>Lo scelgo io in base ai compiti. Ora: <b>{LEVELS[livePlan.level].label.toLowerCase()}</b>.</span>
              </button>
              {(Object.keys(LEVELS) as (keyof typeof LEVELS)[]).map((level) => (
                <button key={level} role="radio" aria-checked={preset === level} className={preset === level ? "preset on" : "preset"} onClick={() => choosePreset(level)}>
                  <strong>{LEVELS[level].label} · {LEVELS[level].work} min + {LEVELS[level].rest} min</strong>
                  <span>{LEVELS[level].hint}</span>
                </button>
              ))}
            </div>
            {native ? (
              <div className="notification-row">
                <div><strong>Silenzioso automatico</strong><span>{silentOk ? "Attivo: parte con il timer e si toglie in pausa." : "Serve il tuo consenso una volta sola (accesso “Non disturbare”)."}</span></div>
                {!silentOk && <button className="install-go" onClick={() => void openSilentSettings()}>Concedi</button>}
              </div>
            ) : (
            <div className="notification-row">
              <div><strong>Suono e notifiche</strong><span>Avvisi a fine blocco, fine pausa e all’orario di inizio.</span></div>
              <button className={alertsOn ? "toggle on" : "toggle"} onClick={toggleAlerts} type="button" role="switch" aria-checked={alertsOn} aria-label="Suono e notifiche"><span/></button>
            </div>
            )}
            <label className="field-label">Orario di inizio compiti
              <input type="time" value={startTime} onChange={(e) => changeStartTime(e.target.value)}/>
            </label>
            {!native && <details className="silent-tips">
              <summary>Come attivare il silenzioso mentre studi</summary>
              <p>Un’app web non può cambiare le impostazioni audio del telefono: si fa una volta sola dal telefono, e poi è automatico.</p>
              <p><strong>iPhone:</strong> app Comandi → Automazione → “Quando apro un’app” → Filo → “Imposta Focus” → Non disturbare (e “Quando chiudo” per disattivarlo).</p>
              <p><strong>Android:</strong> Impostazioni → Benessere digitale (o “Modalità”) → Modalità concentrazione/Non disturbare → scegli Filo come app da pianificare o attiva la modalità quando inizi.</p>
              {!notificationsSupported() && <p>Questo browser non supporta le notifiche: resteranno suono e vibrazione.</p>}
            </details>}
            <p className="field-help">Il programma automatico considera i compiti per oggi e domani, quante materie sono e quanto lavoro richiede ciascuna. Il timer in corso non cambia durata a metà sessione.</p>
          </section>
        </div>
      )}
    </main>
  );
}
