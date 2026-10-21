 "use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlarmClock, ArrowLeft, Bell, Check, CheckCircle2, ChevronRight, CircleHelp,
  Clock3, Coffee, ListTodo, Pause, Play, Plus, RotateCcw, Settings2, SkipForward,
  Sparkles, Square, Trash2, X
} from "lucide-react";
import {
  clearAllData, getSessions, getSetting, getTasks, removeTask, saveSession,
  saveTask, setSetting, type StudySession, type Task
} from "@/lib/db";

type Mode = "idle" | "work" | "break" | "paused";
type View = "today" | "week" | "settings";

const DEFAULT_WORK = 20;
const DEFAULT_BREAK = 10;
const START_TIME = "16:30";

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
function dateKey(timestamp: number) {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function sameDay(a: number, b: number) {
  return dateKey(a) === dateKey(b);
}
function weekStart(date: Date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0,0,0,0);
  return d.getTime();
}

export default function Home() {
  const [ready, setReady] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [taskInput, setTaskInput] = useState("");
  const [mode, setMode] = useState<Mode>("idle");
  const [view, setView] = useState<View>("today");
  const [workMinutes, setWorkMinutes] = useState(DEFAULT_WORK);
  const [breakMinutes, setBreakMinutes] = useState(DEFAULT_BREAK);
  const [startTime, setStartTime] = useState(START_TIME);
  const [notifications, setNotifications] = useState(false);
  const [remaining, setRemaining] = useState(DEFAULT_WORK * 60);
  const [endAt, setEndAt] = useState<number | null>(null);
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [workSeconds, setWorkSeconds] = useState(0);
  const [notice, setNotice] = useState("");
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const breakRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    const [nextTasks, nextSessions, w, b, t, n] = await Promise.all([
      getTasks(), getSessions(), getSetting("workMinutes", DEFAULT_WORK),
      getSetting("breakMinutes", DEFAULT_BREAK), getSetting("startTime", START_TIME),
      getSetting("notifications", false)
    ]);
    setTasks(nextTasks.sort((a,b) => a.createdAt - b.createdAt));
    setSessions(nextSessions.sort((a,b) => b.startedAt - a.startedAt));
    setWorkMinutes(w); setBreakMinutes(b); setStartTime(t); setNotifications(n);
    setRemaining(w * 60);
    setReady(true);
  }, []);

  useEffect(() => {
    refresh().catch(() => setReady(true));
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const handler = (event: Event) => setInstallPrompt(event as any);
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [refresh]);

  useEffect(() => {
    if (mode !== "work" && mode !== "break") return;
    timerRef.current = setInterval(() => {
      if (!endAt) return;
      const seconds = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setRemaining(seconds);
      if (mode === "work") setWorkSeconds((v) => v + 1);
      if (seconds <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        if (mode === "work") {
          setMode("break");
          setRemaining(breakMinutes * 60);
          setEndAt(Date.now() + breakMinutes * 60 * 1000);
          showSystemNotification("Blocco completato", "Salva il punto e fai una pausa.");
          setNotice("Blocco completato. Pausa di 10 minuti.");
        } else {
          setMode("paused");
          setEndAt(null);
          setNotice("Pausa finita. Quando vuoi, riparti.");
          showSystemNotification("Pausa finita", "Quando vuoi, puoi ripartire.");
        }
      }
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [mode, endAt, breakMinutes]);

  function showSystemNotification(title: string, body: string) {
    if (!notifications || typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "granted") {
      try { new Notification(title, { body, icon: "/icon.svg" }); } catch {}
    }
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const title = taskInput.trim();
    if (!title) return;
    await saveTask({ id: uid(), title, status: "todo", createdAt: Date.now() });
    setTaskInput("");
    await refresh();
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

  async function startWork() {
    const now = Date.now();
    if (mode === "idle") {
      setSessionStart(now);
      setWorkSeconds(0);
    }
    setMode("work");
    setRemaining(workMinutes * 60);
    setEndAt(now + workMinutes * 60 * 1000);
    setNotice("");
    showSystemNotification("Si parte", "Un compito alla volta.");
  }

  async function pauseTimer() {
    setMode("paused");
    setEndAt(null);
    setNotice("Timer in pausa. Puoi riprendere quando sei pronto.");
  }

  async function startBreak() {
    setMode("break");
    setRemaining(breakMinutes * 60);
    setEndAt(Date.now() + breakMinutes * 60 * 1000);
    setNotice("");
  }

  async function resumeWork() {
    setMode("work");
    setRemaining(workMinutes * 60);
    setEndAt(Date.now() + workMinutes * 60 * 1000);
    setNotice("");
  }

  async function finishSession() {
    const now = Date.now();
    if (sessionStart && workSeconds > 0) {
      await saveSession({
        id: uid(), startedAt: sessionStart, endedAt: now,
        workMinutes: Math.max(1, Math.round(workSeconds / 60)),
        completedTaskIds: tasks.filter(t => t.status === "done" && (t.completedAt || 0) >= sessionStart).map(t => t.id)
      });
    }
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setMode("idle"); setEndAt(null); setSessionStart(null); setWorkSeconds(0);
    setRemaining(workMinutes * 60);
    setNotice("Sessione chiusa. Controlla cosa hai completato e cosa resta.");
    await refresh();
  }

  async function requestNotifications() {
    if (!("Notification" in window)) {
      setNotice("Questo browser non supporta le notifiche web.");
      return;
    }
    const permission = await Notification.requestPermission();
    const enabled = permission === "granted";
    setNotifications(enabled);
    await setSetting("notifications", enabled);
    setNotice(enabled ? "Notifiche attivate per gli avvisi mentre Filo è in esecuzione." : "Notifiche non attivate. Puoi usare comunque il timer nell'app.");
  }

  async function savePreferences() {
    await Promise.all([
      setSetting("workMinutes", workMinutes),
      setSetting("breakMinutes", breakMinutes),
      setSetting("startTime", startTime),
      setSetting("notifications", notifications)
    ]);
    setRemaining(workMinutes * 60);
    setShowSettings(false);
    setNotice("Impostazioni salvate.");
  }

  const now = Date.now();
  const todaySessions = useMemo(() => sessions.filter(s => sameDay(s.startedAt, now)), [sessions, now]);
  const weekSessions = useMemo(() => sessions.filter(s => s.startedAt >= weekStart(new Date())), [sessions]);
  const todayMinutes = todaySessions.reduce((sum, s) => sum + s.workMinutes, 0);
  const weekMinutes = weekSessions.reduce((sum, s) => sum + s.workMinutes, 0);
  const doneToday = tasks.filter(t => t.status === "done" && t.completedAt && sameDay(t.completedAt, now)).length;
  const timerLabel = mode === "break" ? "PAUSA" : mode === "paused" ? "IN PAUSA" : mode === "work" ? "FOCUS" : "PRONTO QUANDO VUOI";
  const progress = mode === "break"
    ? 1 - remaining / (breakMinutes * 60)
    : mode === "work" ? 1 - remaining / (workMinutes * 60) : 0;

  if (!ready) return <main className="loading">Filo si sta preparando…</main>;

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" onClick={(e) => { e.preventDefault(); setView("today"); }}>
          <span className="brand-mark">f</span><span>filo</span>
        </a>
        <div className="top-actions">
          {installPrompt && <button className="icon-btn" aria-label="Installa Filo" onClick={async () => { await installPrompt.prompt(); setInstallPrompt(null); }}><Plus size={18}/></button>}
          <button className="icon-btn" aria-label="Impostazioni" onClick={() => setShowSettings(true)}><Settings2 size={18}/></button>
        </div>
      </header>

      <nav className="tabs" aria-label="Navigazione principale">
        <button className={view === "today" ? "tab active" : "tab"} onClick={() => setView("today")}><Clock3 size={16}/> Oggi</button>
        <button className={view === "week" ? "tab active" : "tab"} onClick={() => setView("week")}><Sparkles size={16}/> Progressi</button>
      </nav>

      {view === "today" ? (
        <>
          <section className="welcome">
            <p className="eyebrow">{new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</p>
            <h1>Un passo alla volta.</h1>
            <p className="subhead">Organizza il tempo. Il resto viene dopo.</p>
          </section>

          <section className="timer-card">
            <div className="timer-top">
              <span className="pill"><span className={`status-dot ${mode}`}></span>{timerLabel}</span>
              <span className="duration-setting">{workMinutes} min focus · {breakMinutes} min pausa</span>
            </div>
            <div className="timer-ring" style={{ "--progress": `${Math.min(100, Math.max(0, progress * 100))}%` } as React.CSSProperties}>
              <div className="timer-inner">
                <span className="timer-time">{formatTime(remaining)}</span>
                <span className="timer-caption">{mode === "break" ? "Stacca un po’" : mode === "work" ? "Una cosa alla volta" : mode === "paused" ? "Pronto a ripartire" : "Il tuo tempo, alle tue regole"}</span>
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
              ) : mode === "break" ? (
                <>
                  <button className="primary-btn" onClick={resumeWork}><Play size={17} fill="currentColor}/> Riprendi</button>
                  <button className="secondary-btn" onClick={finishSession}><Check size={17}/> Chiudi sessione</button>
                </>
              ) : (
                <>
                  <button className="primary-btn" onClick={resumeWork}><Play size={17} fill="currentColor}/> Riprendi</button>
                  <button className="secondary-btn" onClick={finishSession}><Square size={15}/> Chiudi sessione</button>
                </>
              )}
            </div>
            {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="Chiudi avviso" onClick={() => setNotice("")}><X size={14}/></button></div>}
          </section>

          <section className="tasks-section">
            <div className="section-heading">
              <div><p className="eyebrow">LA TUA LISTA</p><h2>Che cosa vuoi chiudere oggi?</h2></div>
              <span className="task-count">{tasks.filter(t => t.status === "done").length}/{tasks.length}</span>
            </div>
            <form className="task-form" onSubmit={addTask}>
              <input value={taskInput} onChange={e => setTaskInput(e.target.value)} placeholder="Aggiungi un compito…" aria-label="Nuovo compito" maxLength={140}/>
              <button type="submit" aria-label="Aggiungi compito" disabled={!taskInput.trim()}><Plus size={19}/></button>
            </form>
            <div className="task-list">
              {tasks.length === 0 ? (
                <div className="empty-state"><ListTodo size={25}/><p>La lista è vuota.</p><span>Aggiungi una cosa da fare. Anche una sola va bene.</span></div>
              ) : tasks.map(task => (
                <div className={`task-row ${task.status === "done" ? "completed" : ""}`} key={task.id}>
                  <button className="check-btn" aria-label={task.status === "done" ? "Segna da fare" : "Segna completato"} onClick={() => toggleTask(task)}>{task.status === "done" ? <Check size={16}/> : <span/>}</button>
                  <span className="task-title">{task.title}</span>
                  <button className="delete-btn" aria-label="Elimina compito" onClick={() => deleteTask(task.id)}><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          </section>

          <section className="bottom-stats">
            <div><span className="stat-icon"><Clock3 size={17}/></span><div><strong>{todayMinutes} min</strong><span>studio registrato oggi</span></div></div>
            <div><span className="stat-icon"><CheckCircle2 size={17}/></span><div><strong>{doneToday}</strong><span>compiti completati oggi</span></div></div>
          </section>
          <p className="privacy-note">I tuoi dati restano su questo dispositivo. Nessun account.</p>
        </>
      ) : (
        <section className="progress-page">
          <p className="eyebrow">ULTIMI 7 GIORNI</p>
          <h1>I tuoi progressi.</h1>
          <p className="subhead">Non è una gara. Serve a capire cosa funziona.</p>
          <div className="summary-grid">
            <div className="summary-card"><span>Tempo di studio</span><strong>{weekMinutes} <small>min</small></strong></div>
            <div className="summary-card"><span>Sessioni concluse</span><strong>{weekSessions.length}</strong></div>
            <div className="summary-card"><span>Compiti completati oggi</span><strong>{doneToday}</strong></div>
          </div>
          <h2>Giorno per giorno</h2>
          <div className="week-list">
            {Array.from({length: 7}, (_, i) => {
              const date = new Date(); date.setDate(date.getDate() - (6-i));
              const mins = sessions.filter(s => sameDay(s.startedAt, date.getTime())).reduce((sum,s) => sum + s.workMinutes, 0);
              return <div className="week-row" key={date.toISOString()}><span>{new Intl.DateTimeFormat("it-IT",{weekday:"short",day:"numeric"}).format(date)}</span><div className="bar-track"><div className="bar-fill" style={{width: `${Math.min(100, mins / 60 * 100)}%`}}/></div><strong>{mins}′</strong></div>;
            })}
          </div>
          <p className="privacy-note">I progressi si basano sulle sessioni che chiudi nell’app. Non misurano quanto sei bravo: mostrano soltanto come hai usato il tempo.</p>
        </section>
      )}

      {showSettings && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}>
          <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <div className="modal-head"><div><p className="eyebrow">PERSONALIZZA</p><h2 id="settings-title">Le tue impostazioni</h2></div><button className="icon-btn" onClick={() => setShowSettings(false)} aria-label="Chiudi"><X size={18}/></button></div>
            <label className="field-label">Durata del blocco <strong>{workMinutes} minuti</strong><input type="range" min="10" max="35" step="5" value={workMinutes} onChange={e => setWorkMinutes(Number(e.target.value))}/><span className="range-hints"><span>10 min</span><span>35 min</span></span></label>
            <label className="field-label">Durata della pausa <strong>{breakMinutes} minuti</strong><input type="range" min="5" max="15" step="5" value={breakMinutes} onChange={e => setBreakMinutes(Number(e.target.value))}/><span className="range-hints"><span>5 min</span><span>15 min</span></span></label>
            <label className="field-label">Orario indicativo di inizio<input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}/><span className="field-help">È un promemoria di riferimento; non avvia lo studio automaticamente.</span></label>
            <div className="notification-row"><div><strong>Notifiche</strong><span>Avvisi quando l'app è in esecuzione.</span></div><button className={notifications ? "toggle on" : "toggle"} onClick={requestNotifications} type="button"><span/></button></div>
            <p className="field-help">Le notifiche a app chiusa dipendono dal browser e dal dispositivo. Questa versione non invia ancora notifiche push remote.</p>
            <button className="primary-btn full-btn" onClick={savePreferences}>Salva impostazioni</button>
            <button className="danger-link" onClick={async () => { if (confirm("Eliminare tutte le attività, le sessioni e le impostazioni salvate su questo dispositivo?")) { await clearAllData(); setMode("idle"); setSessionStart(null); await refresh(); setShowSettings(false); } }}>Elimina tutti i dati locali</button>
          </section>
        </div>
      )}

      <footer className="footer"><span>filo</span><span>Un passo alla volta.</span></footer>
    </main>
  );
}
