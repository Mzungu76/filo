"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, ChevronDown, ChevronRight, Gift, Sparkles, House as HomeIcon, Building2, Trophy, Check, ClipboardPaste, Coffee, Download, ImageUp, Settings2, ListTodo, Pause, Play, Plus, Square, Trash2, X } from "lucide-react";
import { getSessions, getSetting, getTasks, removeTask, saveSession, saveTask, setSetting, type StudySession, type Task } from "@/lib/db";
import { parseDidup } from "@/lib/didup";
import { readImageText } from "@/lib/ocr";
import { askNotificationPermission, chime, keepAwake, notificationsSupported, notify, unlockAudio, vibrate } from "@/lib/alerts";
import { useInstall } from "@/lib/install";
import { advance as stepTimer } from "@/lib/timer";
import { computeStats } from "@/lib/stats";
import { pickQuote, type QuoteKind } from "@/lib/quotes";
import StatsView from "./StatsView";
import { BigRing, Ring, subjectHue, tap } from "./ui";
import GoalsView from "./GoalsView";
import { LevelBadge } from "./LevelBadge";
import BuildingIcon, { BUILDING_NAME } from "./Buildings";
import { TIER_NAMES, challengeProgress, computeMetrics, computePoints, levelOf, medalStates, planChallenges, rhythm as computeRhythm, type Challenge, type ChallengePlan, type MedalIcon, type Tier } from "@/lib/goals";
import { weekStart as weekStartOf } from "@/lib/stats";
import { CHECK_PATH, THREAD_PATH } from "@/lib/brandPath";
import { setStatusBar, SUGGESTED_BLOCKED, consumeBlocked, guardStatus, listApps, openAccessibilitySettings, openAppInfo, setGuard, snoozeGuard, askNativeNotifications, cancelNative, pickAndReadImage, hasSilentAccess, isNative, openSilentSettings, scheduleNative, setSilent } from "@/lib/native";
import { LEVELS, planFor, type Plan, type Preset } from "@/lib/workload";

type Mode = "idle" | "work" | "break" | "paused";
type Celebration = { kind: "medal" | "level" | "challenge" | "reward"; title: string; text: string; icon?: MedalIcon; tier?: Tier; level?: number };

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
/** Data locale in formato AAAA-MM-GG, a `offset` giorni da oggi (per il selettore di data). */
function dayKey(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function byDue(a: Task, b: Task) {
  return (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity) || a.createdAt - b.createdAt;
}

export default function Home() {
  const [ready, setReady] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [taskInput, setTaskInput] = useState("");
  const [taskDate, setTaskDate] = useState(""); // AAAA-MM-GG, vuoto = senza scadenza
  const [mode, setMode] = useState<Mode>("idle");
  const [remaining, setRemaining] = useState(0);
  const [preset, setPreset] = useState<Preset>("auto");
  const [lockedPlan, setLockedPlan] = useState<Plan | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState<"auto" | "light" | "dark">("auto");
  const [focusOpen, setFocusOpen] = useState(true);
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmFree, setConfirmFree] = useState(false);
  const [skipFreeWarn, setSkipFreeWarn] = useState(false);
  const addRef = useRef<HTMLInputElement>(null);
  const dragY = useRef<number | null>(null);
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
  const [view, setView] = useState<"today" | "stats" | "goals">("today");
  const [bonus, setBonus] = useState(0);
  const [plan2, setPlan2] = useState<ChallengePlan | null>(null);
  const [reward, setReward] = useState<{ text: string; need: number }>({ text: "", need: 2 });
  const [rewardClaimed, setRewardClaimed] = useState(0);
  const [celebrateOn, setCelebrateOn] = useState(true);
  const [celebrations, setCelebrations] = useState<Celebration[]>([]);
  const [goalsLoaded, setGoalsLoaded] = useState(false);
  const [records, setRecords] = useState<Record<string, number>>({});
  const goalsRef = useRef<{ plan: ChallengePlan | null; bonus: number; seen: { medals: Record<string, number>; level: number } | null; records: Record<string, number>; reward: { text: string; need: number }; claimed: number; notified: number; celebrate: boolean }>(
    { plan: null, bonus: 0, seen: null, records: {}, reward: { text: "", need: 2 }, claimed: 0, notified: 0, celebrate: true });
  const dataRef = useRef<{ sessions: StudySession[]; tasks: Task[] }>({ sessions: [], tasks: [] });
  const syncing = useRef(false);
  const resistedRef = useRef(0);
  const [quotesOn, setQuotesOn] = useState(true);
  const [quote, setQuote] = useState<string | null>(null);
  const [blockedQuote, setBlockedQuote] = useState("");
  const modeRef = useRef<Mode>("idle");
  const subjectRef = useRef("Altro");
  const subjectMsRef = useRef<Record<string, number>>({});
  const blocksRef = useRef(0);
  const distractionsRef = useRef(0);
  const [guardOn, setGuardOn] = useState(false);
  const [guardApps, setGuardApps] = useState<string[]>([]);
  const [guardService, setGuardService] = useState(false);
  const [guardAvailable, setGuardAvailable] = useState(false);
  const [installed, setInstalled] = useState<{ package: string; label: string }[]>([]);
  const [showApps, setShowApps] = useState(false);
  const [appSearch, setAppSearch] = useState("");
  const [blockedApp, setBlockedApp] = useState<string | null>(null);
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
    setQuotesOn(await getSetting("quotes", true));
    const [gOn, gApps] = await Promise.all([getSetting("guardOn", false), getSetting<string[]>("guardApps", [])]);
    setGuardOn(gOn);
    setGuardApps(gApps);
    void setGuard(gOn, gApps);
    setAlertsOn(savedAlerts);
    setStartTime(savedStart);
    const g = goalsRef.current;
    const [gPlan, gBonus, gSeen, gRecords, gReward, gClaimed, gNotified, gCelebrate] = await Promise.all([
      getSetting<ChallengePlan | null>("challenges", null), getSetting("bonus", 0),
      getSetting<{ medals: Record<string, number>; level: number } | null>("seen2", null),
      getSetting<Record<string, number>>("records", {}),
      getSetting("reward", { text: "", need: 2 }), getSetting("rewardClaimed", 0), getSetting("rewardNotified", 0), getSetting("celebrate", true)
    ]);
    Object.assign(g, { plan: gPlan, bonus: gBonus, seen: gSeen, records: gRecords, reward: gReward, claimed: gClaimed, notified: gNotified, celebrate: gCelebrate });
    setPlan2(gPlan); setRecords(gRecords); setBonus(gBonus); setReward(gReward); setRewardClaimed(gClaimed); setCelebrateOn(gCelebrate);
    setGoalsLoaded(true);
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

  // Tema: scelta salvata, applicata al documento; la barra di stato di Android la segue.
  useEffect(() => {
    try { const t = localStorage.getItem("filo-theme"); if (t === "light" || t === "dark") setTheme(t); } catch {}
  }, []);
  useEffect(() => {
    if (theme === "auto") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => void setStatusBar(view === "today" || theme === "dark" || (theme === "auto" && mq.matches), view === "today" ? "#102b3a" : undefined);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme, view]);
  function changeTheme(next: "auto" | "light" | "dark") {
    setTheme(next);
    try { localStorage.setItem("filo-theme", next); } catch {}
  }

  // Con la tastiera aperta la barra in basso si nasconde: lascia spazio a ciò che stai scrivendo.
  useEffect(() => {
    const isField = (t: EventTarget | null) => t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
    const on = (e: FocusEvent) => { if (isField(e.target)) document.documentElement.classList.add("typing"); };
    const off = () => document.documentElement.classList.remove("typing");
    document.addEventListener("focusin", on);
    document.addEventListener("focusout", off);
    return () => { document.removeEventListener("focusin", on); document.removeEventListener("focusout", off); };
  }, []);

  // Gli avvisi sono messaggi brevi: scompaiono da soli.
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 9000);
    return () => clearTimeout(id);
  }, [notice]);

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
    const check = () => {
      void hasSilentAccess().then(setSilentOk);
      void guardStatus().then((g) => { setGuardService(g.serviceEnabled); setGuardAvailable(g.available); });
    };
    check();
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, [native]);

  // Città: sfide della settimana, nuovi edifici, livelli e premio. Tutto derivato dai dati: niente da dichiarare a mano.
  useEffect(() => {
    if (!ready || !goalsLoaded) return;
    // Raccoglie le feste di questo giro e ne mostra poche: medaglie migliori, livello, sfide unite, premio.
    const queue: Celebration[] = [];
    const lostNames: string[] = [];
    const celebrate = (c: Celebration) => { queue.push(c); };
    const flush = () => {
      const medalsNew = queue.filter((c) => c.kind === "medal").sort((a, b) => (b.tier ?? 0) - (a.tier ?? 0));
      const challengesNew = queue.filter((c) => c.kind === "challenge");
      const merged: Celebration[] = challengesNew.length > 1
        ? [{ kind: "challenge", title: "Sfide completate!", text: `${challengesNew.map((c) => c.text.split(" · ")[0]).join(" · ")} · +${20 * challengesNew.length} punti` }]
        : challengesNew;
      const show = [...medalsNew.slice(0, 3), ...queue.filter((c) => c.kind === "level"), ...merged, ...queue.filter((c) => c.kind === "reward")];
      const extra = medalsNew.length - 3;
      const messages: string[] = [];
      if (lostNames.length) messages.push(`Si sono spenti o ridotti: ${lostNames.join(", ")}. Un po' di studio e li riaccendi: il record resta tuo.`);
      if (show.length > 0 && goalsRef.current.celebrate) {
        setCelebrations((q) => [...q, ...show]);
        if (extra > 0) messages.push(`Hai costruito altri ${extra} edifici: li trovi in Città.`);
      } else if (show.length > 0) {
        messages.push(show.map((c) => c.title).join(" · ") + (extra > 0 ? ` · +${extra} edifici` : ""));
      }
      if (messages.length) setNotice(messages.join(" "));
    };
    const run = async () => {
      if (syncing.current) return;
      syncing.current = true;
      try {
        const g = goalsRef.current;
        const { sessions: ss, tasks: tt } = dataRef.current;
        const nowTs = Date.now();
        const wk = weekStartOf(nowTs);
        // 1) piano della settimana
        if (!g.plan || g.plan.week !== wk) {
          g.plan = planChallenges(ss, tt, nowTs);
          await setSetting("challenges", g.plan);
        }
        // 2) sfide completate: +20 punti ciascuna
        const fresh = g.plan.items.filter((c) => !g.plan!.doneIds.includes(c.id) && challengeProgress(c, ss, tt, nowTs) >= c.target);
        if (fresh.length) {
          g.plan = { ...g.plan, doneIds: [...g.plan.doneIds, ...fresh.map((c) => c.id)] };
          g.bonus += 20 * fresh.length;
          await Promise.all([setSetting("challenges", g.plan), setSetting("bonus", g.bonus)]);
          setBonus(g.bonus);
          fresh.forEach((c) => celebrate({ kind: "challenge", title: "Sfida completata!", text: `${c.title} · +20 punti` }));
        }
        setPlan2(g.plan);
        // 3) medaglie (contano le ultime 4 settimane: possono salire e scendere) e livello (non scende mai)
        const states = medalStates(computeMetrics(ss, tt, nowTs));
        const pts = levelOf(computePoints(ss, tt, g.bonus, nowTs).total);
        const tiersNow = Object.fromEntries(states.map((m) => [m.def.id, m.tier]));
        if (g.seen === null) {
          g.seen = { medals: tiersNow, level: pts.level }; // primo avvio con questa funzione: niente festa per ciò che c'era già
          g.records = { ...tiersNow };
          await Promise.all([setSetting("seen2", g.seen), setSetting("records", g.records)]);
          setRecords(g.records);
        } else {
          for (const m of states) {
            const before = g.seen.medals[m.def.id] ?? 0;
            const best = g.records[m.def.id] ?? 0;
            if (m.tier > before) {
              celebrate({ kind: "medal", title: `${BUILDING_NAME[m.def.icon]}: ${best === 0 ? "nuovo edificio!" : m.tier <= best ? "di nuovo acceso!" : "ampliato!"}`, text: `${m.def.name} · ${TIER_NAMES[m.tier]}. ${m.def.why}`, icon: m.def.icon, tier: m.tier });
            } else if (m.tier < before) {
              lostNames.push(`${BUILDING_NAME[m.def.icon]} (${m.tier === 0 ? "spento" : TIER_NAMES[m.tier].toLowerCase()})`);
            }
          }
          if (pts.level > g.seen.level) celebrate({ kind: "level", title: `Livello ${pts.level}: ${pts.name}`, text: "Stai costruendo qualcosa di solido, un blocco alla volta.", level: pts.level });
          const nextSeen = { medals: tiersNow, level: Math.max(pts.level, g.seen.level) };
          const nextRecords = { ...g.records, ...Object.fromEntries(states.map((m) => [m.def.id, Math.max(m.tier, g.records[m.def.id] ?? 0)])) };
          if (JSON.stringify(nextSeen) !== JSON.stringify(g.seen)) { g.seen = nextSeen; await setSetting("seen2", g.seen); }
          if (JSON.stringify(nextRecords) !== JSON.stringify(g.records)) { g.records = nextRecords; await setSetting("records", g.records); setRecords(g.records); }
        }
        // 4) premio scelto dall'utente
        const doneNow = g.plan.items.filter((c) => g.plan!.doneIds.includes(c.id) || challengeProgress(c, ss, tt, nowTs) >= c.target).length;
        if (g.reward.text && doneNow >= g.reward.need && g.claimed !== wk && g.notified !== wk) {
          g.notified = wk;
          await setSetting("rewardNotified", wk);
          celebrate({ kind: "reward", title: "Premio meritato!", text: `Hai completato ${g.reward.need} ${g.reward.need === 1 ? "sfida" : "sfide"}: ora puoi prenderti ${g.reward.text}.` });
          if (document.hidden) void notify("Premio meritato!", `Ora puoi prenderti ${g.reward.text}.`);
        }
      } finally {
        syncing.current = false;
        flush();
      }
    };
    void run();
  }, [ready, goalsLoaded, sessions, tasks]);

  // Se un'app bloccata è stata aperta, il servizio ci ha riportato qui: mostra il promemoria.
  useEffect(() => {
    if (!native || !guardOn) return;
    const look = () => {
      void consumeBlocked().then((label) => {
        if (!label) return;
        if (modeRef.current === "work") distractionsRef.current++;
        setBlockedQuote(pickQuote("blocked"));
        setBlockedApp(label);
      });
    };
    look();
    const id = setInterval(look, 1500);
    document.addEventListener("visibilitychange", look);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", look); };
  }, [native, guardOn]);

  useEffect(() => {
    if ((mode !== "work" && mode !== "break") || !endAt) return;
    const tick = () => {
      const t = Date.now();
      // Se l'app è rimasta sospesa, recupera tutte le fasi trascorse (blocco → pausa → blocco…).
      const r = stepTimer(mode, endAt, lastTickRef.current, t, plan);
      lastTickRef.current = t;
      if (r.workMs > 0) {
        setWorkSeconds((v) => v + r.workMs / 1000);
        const name = subjectRef.current;
        subjectMsRef.current[name] = (subjectMsRef.current[name] ?? 0) + r.workMs;
      }
      setRemaining(Math.max(0, Math.ceil((r.endAt - t) / 1000)));
      if (r.crossed > 0) {
        blocksRef.current += mode === "work" ? Math.ceil(r.crossed / 2) : Math.floor(r.crossed / 2);
        setQuote(pickQuote(r.phase === "break" ? "break" : "start"));
        setMode(r.phase);
        setEndAt(r.endAt);
        // A fine pausa Android fa suonare l'avviso: il silenzioso riparte dopo, non subito.
        if (r.phase === "work") setTimeout(() => void setSilent(true), 4500);
        else void setSilent(false);
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
  subjectRef.current = current?.subject ?? "Altro";
  modeRef.current = mode;
  const todayMinutes = sessions.filter((s) => s.startedAt >= startOfDay(now)).reduce((sum, s) => sum + s.workMinutes, 0);
  const weekMinutes = sessions.filter((s) => s.startedAt >= weekStart(now)).reduce((sum, s) => sum + s.workMinutes, 0);

  dataRef.current = { sessions, tasks };
  const metrics = useMemo(() => computeMetrics(sessions, tasks, Date.now()), [sessions, tasks]);
  const metricsLater = useMemo(() => computeMetrics(sessions, tasks, Date.now() + 7 * 24 * 3600 * 1000), [sessions, tasks]);
  const medals = useMemo(() => medalStates(metrics, metricsLater), [metrics, metricsLater]);
  const atRisk = medals.filter((m) => m.riskNeed !== null).length;
  const points = useMemo(() => computePoints(sessions, tasks, bonus, Date.now()), [sessions, tasks, bonus]);
  const level = levelOf(points.total);
  const rhythm = useMemo(() => computeRhythm(sessions, Date.now()), [sessions]);
  const challenges = useMemo(() => (plan2 && plan2.week === weekStartOf(Date.now()) ? plan2.items : []).map((c: Challenge) => {
    const progress = challengeProgress(c, sessions, tasks, Date.now());
    return { c, progress, done: progress >= c.target || (plan2?.doneIds ?? []).includes(c.id) };
  }), [plan2, sessions, tasks]);
  const doneCount = challenges.filter((c) => c.done).length;
  const rewardReady = !!reward.text && doneCount >= reward.need && rewardClaimed !== weekStartOf(Date.now());
  const stats = useMemo(() => computeStats(sessions, tasks, Date.now(), startTime), [sessions, tasks, startTime]);
  const preview = useMemo(() => parseDidup(importText), [importText]);
  const toAdd = preview.filter((_, i) => !skipped.includes(i));

  const timerLabel = mode === "break" ? "PAUSA" : mode === "paused" ? "IN PAUSA" : mode === "work" ? "FOCUS" : "PRONTO";
  const total = (mode === "break" ? plan.rest : plan.work) * 60;
  const shown = mode === "idle" ? plan.work * 60 : remaining;
  const progress = mode === "idle" || mode === "paused" ? 0 : 1 - remaining / total;
  // Anello "Time Timer": pieno quando è pronto, si consuma man mano che il tempo passa.
  const ringValue = mode === "idle" ? 1 : Math.max(0, Math.min(1, remaining / total));

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const title = taskInput.trim();
    if (!title) return;
    const [y, m, d] = taskDate ? taskDate.split("-").map(Number) : [];
    const dueDate = taskDate ? new Date(y, m - 1, d).getTime() : undefined;
    await saveTask({ id: uid(), title, status: "todo", createdAt: Date.now(), dueDate });
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

  async function importImage(e?: React.ChangeEvent<HTMLInputElement>) {
    const file = e?.target.files?.[0];
    if (e) e.target.value = "";
    if (!file && !native) return;
    setReading(native ? -1 : 0);
    try {
      // Su Android si usa il riconoscimento del sistema; nel browser Tesseract.
      const text = native ? await pickAndReadImage() : await readImageText(file!, setReading);
      if (text === null) return;
      setImportText(text);
      setSkipped([]);
      if (parseDidup(text).length === 0) setNotice("Non ho trovato compiti nell'immagine: controlla il testo qui sotto o prova con uno screenshot più nitido.");
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      setNotice(`Non sono riuscito a leggere l'immagine (${reason}). Riprova, oppure incolla il testo.`);
    } finally {
      setReading(null);
    }
  }

  async function saveGuard(on: boolean, apps: string[]) {
    setGuardOn(on);
    setGuardApps(apps);
    await Promise.all([setSetting("guardOn", on), setSetting("guardApps", apps)]);
    await setGuard(on, apps);
  }

  async function openAppPicker() {
    const apps = (await listApps()).sort((a, b) => a.label.localeCompare(b.label, "it"));
    setInstalled(apps);
    // Prima volta: preseleziona le app di distrazione più comuni tra quelle installate.
    if (guardApps.length === 0) {
      const preset = apps.filter((a) => SUGGESTED_BLOCKED.includes(a.package)).map((a) => a.package);
      if (preset.length) await saveGuard(guardOn, preset);
    }
    setAppSearch("");
    setShowApps(true);
  }

  async function toggleGuardApp(pkg: string) {
    await saveGuard(guardOn, guardApps.includes(pkg) ? guardApps.filter((p) => p !== pkg) : [...guardApps, pkg]);
  }

  async function needTwoMinutes() {
    await snoozeGuard(2);
    setBlockedApp(null);
    setNotice("Hai 2 minuti: poi si torna al compito.");
  }

  async function claimReward() {
    const wk = weekStartOf(Date.now());
    goalsRef.current.claimed = wk;
    setRewardClaimed(wk);
    await setSetting("rewardClaimed", wk);
    setNotice("Goditelo: te lo sei meritato.");
  }

  async function changeReward(next: { text: string; need: number }) {
    goalsRef.current.reward = next;
    setReward(next);
    await setSetting("reward", next);
  }

  async function toggleCelebrate() {
    const next = !celebrateOn;
    goalsRef.current.celebrate = next;
    setCelebrateOn(next);
    await setSetting("celebrate", next);
  }

  async function toggleQuotes() {
    const next = !quotesOn;
    setQuotesOn(next);
    await setSetting("quotes", next);
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
    if (next.status === "done") {
      tap(18);
      setQuote(pickQuote("done"));
      setLeavingId(task.id); // la riga scivola via prima di spostarsi tra i "Fatti oggi"
      await new Promise((r) => setTimeout(r, 380));
      setLeavingId(null);
    }
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

  /** Tocco su Play dalla home: senza compiti chiede conferma con un messaggio amichevole. */
  function onPlay() {
    let skip = skipFreeWarn;
    try { skip = skip || localStorage.getItem("filo-skip-free-warning") === "1"; } catch {}
    if (mode === "idle" && open.length === 0 && !skip) { setConfirmFree(true); return; }
    startWork();
  }
  function openAdd() {
    setSheetOpen(true);
    setTimeout(() => addRef.current?.focus(), 380);
  }
  // Pannello dei compiti: si tira su/giù, oppure si tocca la maniglia.
  const closeSheet = () => { setSheetOpen(false); (document.activeElement as HTMLElement | null)?.blur?.(); };
  const sheetDown = (e: React.PointerEvent) => { dragY.current = e.clientY; };
  const sheetUp = (e: React.PointerEvent) => {
    if (dragY.current === null) return;
    const dy = e.clientY - dragY.current;
    dragY.current = null;
    if (dy < -28) setSheetOpen(true);
    else if (dy > 28) closeSheet();
    else if (Math.abs(dy) < 14 && !(e.target as HTMLElement).closest("button")) (sheetOpen ? closeSheet() : setSheetOpen(true));
  };

  function startWork() {
    tap(15);
    setFocusOpen(true);
    prepareAlerts();
    setAdvance(null);
    const start = Date.now();
    if (mode === "idle") {
      setSessionStart(start); setWorkSeconds(0); setLockedPlan(livePlan);
      subjectMsRef.current = {}; blocksRef.current = 0; distractionsRef.current = 0; resistedRef.current = 0;
    }
    setQuote(pickQuote("start"));
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
  function resumeWork() { tap(12); unlockAudio(); setFocusOpen(true); startBlock(plan); }
  function pauseTimer() {
    setMode("paused");
    setEndAt(null);
    setNotice("Timer in pausa. Puoi riprendere quando sei pronto.");
    void setSilent(false);
    void cancelNative();
  }
  function startBreak() {
    tap(12);
    unlockAudio();
    setFocusOpen(true);
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
    setFocusOpen(false);
    if (sessionStart && workSeconds > 0) {
      await saveSession({
        id: uid(), startedAt: sessionStart, endedAt: end,
        workMinutes: Math.max(1, Math.round(workSeconds / 60)),
        completedTaskIds: tasks.filter((t) => t.status === "done" && (t.completedAt || 0) >= sessionStart).map((t) => t.id),
        blocks: blocksRef.current,
        distractions: distractionsRef.current,
        resisted: resistedRef.current,
        subjectMinutes: Object.fromEntries(Object.entries(subjectMsRef.current).map(([k, ms]) => [k, Math.round(ms / 60000)]).filter(([, m]) => (m as number) > 0))
      });
    }
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    void setSilent(false);
    void cancelNative();
    setMode("idle"); setEndAt(null); setSessionStart(null); setWorkSeconds(0);
    setLockedPlan(null);
    setQuote(pickQuote("end"));
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

  const tasksSection = (
      <section className="tasks-section">
        <div className="section-heading">
          <h2>Da fare <span className="count">{open.length}</span></h2>
          <button className="import-btn" onClick={() => setShowImport((v) => !v)}><ClipboardPaste size={15}/> Da DidUP</button>
        </div>

        {showImport && (
          <div className="import-box">
            <p className="field-help">In DidUP apri Diario → Compiti e fai uno screenshot: caricalo qui. In alternativa, copia il testo e incollalo.</p>
            {native ? (
              <button className={`secondary-light upload ${reading !== null ? "busy" : ""}`} onClick={() => void importImage()} disabled={reading !== null}>
                <ImageUp size={15}/> {reading === null ? "Carica screenshot" : "Leggo l’immagine…"}
              </button>
            ) : (
              <label className={`secondary-light upload ${reading !== null ? "busy" : ""}`}>
                <ImageUp size={15}/> {reading === null ? "Carica screenshot" : `Leggo l’immagine… ${Math.round(reading * 100)}%`}
                <input type="file" accept="image/*" onChange={importImage} disabled={reading !== null} hidden/>
              </label>
            )}
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
          <input ref={addRef} value={taskInput} onChange={(e) => setTaskInput(e.target.value)} onFocus={() => setAdding(true)} onBlur={() => setTimeout(() => setAdding(false), 200)}
            placeholder="Aggiungi un compito…" aria-label="Nuovo compito" maxLength={200} enterKeyHint="done"/>
          <button type="submit" aria-label="Aggiungi compito" disabled={!taskInput.trim()}><Plus size={22}/></button>
          {(adding || taskInput || taskDate) && (
            <div className="date-row" onMouseDown={(e) => { if ((e.target as HTMLElement).tagName === "BUTTON") e.preventDefault(); }}>
              <span>Per quando?</span>
              <button type="button" className={taskDate === dayKey(0) ? "chip on" : "chip"} onClick={() => setTaskDate(dayKey(0))}>Oggi</button>
              <button type="button" className={taskDate === dayKey(1) ? "chip on" : "chip"} onClick={() => setTaskDate(dayKey(1))}>Domani</button>
              <input type="date" value={taskDate} min={dayKey(0)} onChange={(e) => setTaskDate(e.target.value)} aria-label="Data di consegna"/>
              {taskDate && <button type="button" className="chip" onClick={() => setTaskDate("")}>Nessuna data</button>}
            </div>
          )}
        </form>

        {open.length === 0 ? (
          <div className="empty-state"><ListTodo size={25}/><p>Nessun compito da fare.</p><span>Importa da DidUP o aggiungine uno a mano.</span></div>
        ) : groups.map(([key, list]) => (
          <div className="task-group" key={key}>
            <p className="group-title">{dueLabel(key === -1 ? undefined : key, now)}</p>
            <div className="task-list">
              {list.map((task) => (
                <div className={`task-row ${task.id === current?.id ? "focused" : ""} ${leavingId === task.id ? "leaving" : ""}`} key={task.id} style={{ "--sc": subjectHue(task.subject) } as React.CSSProperties}>
                  <button className={leavingId === task.id ? "check-btn done" : "check-btn"} aria-label="Segna completato" onClick={() => toggleTask(task)}>{leavingId === task.id && <Check size={16} strokeWidth={3}/>}</button>
                  <button className="task-body" onClick={() => { setFocusId(task.id); setSheetOpen(false); }} aria-label={`Lavora su: ${task.title}`}>
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
                <div className="task-row completed" key={task.id} style={{ "--sc": subjectHue(task.subject) } as React.CSSProperties}>
                  <button className="check-btn" aria-label="Segna da fare" onClick={() => toggleTask(task)}><Check size={16}/></button>
                  <span className="task-body"><span className="task-title">{task.title}</span></span>
                  <button className="delete-btn" aria-label="Elimina compito" onClick={() => deleteTask(task.id)}><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
  );
  const hasTasks = open.length > 0;
  const nextTask = open.find((t) => t.id !== current?.id);
  const planLabel = hasTasks ? `${plan.work} min di studio · poi pausa ${plan.rest}` : "Studio libero · senza compito";

  const topbar = (
      <header className="topbar">
        <span className="brand"><span className="brand-mark" aria-hidden="true">
          <svg viewBox="76 76 360 360" width="100%" height="100%">
            <path d={THREAD_PATH} fill="none" stroke="#9be3c4" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"/>
            <path d={CHECK_PATH} fill="none" stroke="#ffc857" strokeWidth="46" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span><span>filo</span></span>
        <button className="level-pill" onClick={() => setView("goals")} aria-label={`Livello ${level.level} ${level.name}, ${points.total} punti. Apri i traguardi`}>
          <LevelBadge level={level.level} size={30}/>
          <span>{points.total} <small>pt</small></span>
          {(rewardReady || atRisk > 0) && <i className="dot"/>}
        </button>
      </header>
  );
  const isHome = view === "today";
  const ringLabel = mode === "idle" ? "Pronto" : timerLabel;

  return (
    <main className={isHome ? "app-shell home-mode" : "app-shell"}>
            {view === "goals" ? (
        <GoalsView top={topbar} houses={Math.floor(bonus / 20)} level={level} points={points.total} rhythm={rhythm} medals={medals} curStreak={metrics.curStreak} daysThisWeek={metrics.daysThisWeek} records={records}
          challenges={challenges} reward={reward} doneCount={doneCount} rewardReady={rewardReady}
          onClaim={() => void claimReward()} onEditReward={() => setShowSettings(true)}/>
      ) : view === "stats" ? (
        <StatsView top={topbar} stats={stats} quote={quotesOn ? quote ?? pickQuote("idle") : null}/>
      ) : (<>
      <section className="home-hero">
        {topbar}
      {rewardReady && (
        <div className="reward-banner">
          <Gift size={18}/>
          <span>Premio da ritirare: {reward.text}</span>
          <button className="install-go" onClick={() => void claimReward()}>Preso!</button>
        </div>
      )}

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

        <div className="ring-wrap">
          <BigRing value={ringValue}>
            <div className="big-center">
              <span className="big-state"><span className={`status-dot ${mode}`}></span>{ringLabel}</span>
              <span className="big-time">{formatTime(shown)}</span>
              <span className="big-plan">{planLabel}</span>
            </div>
          </BigRing>
          {mode === "idle"
            ? <button className="play-btn" onClick={onPlay} aria-label="Inizia a studiare"><Play size={34} fill="currentColor"/></button>
            : <button className="play-btn wide" onClick={() => setFocusOpen(true)}>Apri sessione</button>}
        </div>

        {mode === "idle" && (
          <div className="hp-row" role="group" aria-label="Ritmo di studio">
            {(["auto", "few", "medium", "many"] as Preset[]).map((p) => (
              <button key={p} className={preset === p ? "hp on" : "hp"} onClick={() => void choosePreset(p)}>
                {p === "auto" ? "Auto" : LEVELS[p].label}
              </button>
            ))}
          </div>
        )}

        {hasTasks ? (
          <div className="home-task">
            <span><small>Adesso</small><b>{current?.title ?? "Scegli un compito"}</b></span>
            <button onClick={() => setSheetOpen(true)}>Cambia ›</button>
          </div>
        ) : (
          <div className="home-task empty">
            <button className="home-add" onClick={openAdd}><Plus size={18}/> Aggiungi compiti</button>
          </div>
        )}
        {quotesOn && quote && mode === "idle" && <p className="quote on-dark">{quote}</p>}
      </section>

      {sheetOpen && <div className="sheet-scrim" onMouseDown={(e) => e.preventDefault()} onClick={closeSheet}/>}
      <div className={sheetOpen ? "sheet open" : "sheet"} role="region" aria-label="Compiti">
        <div className="sheet-head" onMouseDown={(e) => e.preventDefault()} onPointerDown={sheetDown} onPointerUp={sheetUp} onPointerCancel={() => { dragY.current = null; }}>
          <span className="grabber" aria-hidden="true"/>
          {sheetOpen ? (
            <div className="sheet-top">
            <div className="mini-hero">
              <span className="mini-time">{formatTime(shown)}</span>
              <span className="mini-info">{ringLabel}</span>
              {mode === "idle"
                ? <button className="mini-play" onClick={onPlay} aria-label="Inizia a studiare"><Play size={18} fill="currentColor"/></button>
                : mode === "work"
                  ? <button className="mini-play" onClick={pauseTimer} aria-label="Pausa"><Pause size={18} fill="currentColor"/></button>
                  : <button className="mini-play" onClick={resumeWork} aria-label="Riprendi"><Play size={18} fill="currentColor"/></button>}
            </div>
              <button className="sheet-close-btn" onClick={closeSheet} aria-label="Chiudi i compiti"><ChevronDown size={24}/></button>
            </div>
          ) : (
            <div className="peek">
              <b>Da fare <span className="count">{open.length}</span></b>
              <span>{nextTask ? `Poi: ${nextTask.title}` : hasTasks ? "Tira su per vedere i compiti" : "Tira su per aggiungere"}</span>
              <button className="peek-add" onClick={openAdd} aria-label="Aggiungi compiti"><Plus size={20}/></button>
            </div>
          )}
        </div>
        <div className="sheet-body">
{tasksSection}
          <p className="bottom-stats"><span><b>{todayMinutes} min</b> oggi</span><span><b>{weekMinutes} min</b> questa settimana</span></p>
        </div>
      </div>

      {confirmFree && (
        <div className="modal-scrim" onClick={() => setConfirmFree(false)}>
          <div className="advance-card" role="dialog" aria-label="Studi senza compiti" onClick={(e) => e.stopPropagation()}>
            <strong>Stai studiando senza compiti!</strong>
            <p>Non hai ancora niente in lista. Vuoi continuare lo stesso, oppure aggiungi prima un compito?</p>
            <div className="advance-actions">
              <button className="primary-btn dark" onClick={() => { setConfirmFree(false); startWork(); }}>Sì, continuo</button>
              <button className="secondary-light" onClick={() => { setConfirmFree(false); openAdd(); }}>Aggiungo un compito</button>
            </div>
            <button className="link-btn" onClick={() => { try { localStorage.setItem("filo-skip-free-warning", "1"); } catch {} setSkipFreeWarn(true); setConfirmFree(false); startWork(); }}>Non avvisarmi più</button>
          </div>
        </div>
      )}

      {advance && mode === "idle" && (
        <div className="modal-scrim" onClick={() => setAdvance(null)}>
          <div className="advance-card" role="dialog" aria-label="Vuoi avvantaggiarti?" onClick={(e) => e.stopPropagation()}>
            <strong>Vuoi avvantaggiarti?</strong>
            <p>Per oggi sei a posto. Il prossimo compito in scadenza è{advance.subject ? ` ${advance.subject}` : ""}: “{advance.title}” ({dueLabel(advance.dueDate, now).toLowerCase()}).</p>
            <div className="advance-actions">
              <button className="primary-btn dark" onClick={() => { setFocusId(advance.id); setAdvance(null); startWork(); }}>Sì, iniziamo</button>
              <button className="secondary-light" onClick={() => setAdvance(null)}>No, per oggi basta</button>
            </div>
          </div>
        </div>
      )}
      </>)}

      {mode !== "idle" && focusOpen && (
        <div className={`focus-screen phase-${mode}`} role="dialog" aria-label="Sessione di studio">
          <div className="focus-top">
            <button className="icon-btn" onClick={() => setFocusOpen(false)} aria-label="Riduci e torna ai compiti"><ChevronDown size={22}/></button>
            <span className="focus-phase"><span className={`status-dot ${mode}`}></span>{timerLabel}</span>
            <span style={{ width: 44 }}/>
          </div>
          <div className="focus-body">
            <div className="focus-ring">
              <BigRing value={ringValue}>
                {mode === "break" && <span className="breath"/>}
                <div className="big-center">
                  <span className="big-state"><span className={`status-dot ${mode}`}></span>{timerLabel}</span>
                  <span className="big-time">{formatTime(shown)}</span>
                  <span className="big-plan">{plan.work} min studio · {plan.rest} pausa</span>
                </div>
              </BigRing>
            </div>
            {mode === "break" && <p className="breath-hint">Respira lentamente · alza lo sguardo dallo schermo</p>}
            {current && (
              <div className="focus-task"><small>{mode === "break" ? "Dopo la pausa" : "Adesso"}</small><strong>{current.title}</strong></div>
            )}
          </div>
          <div className="focus-bottom">
            {quotesOn && quote && <p className="focus-quote">{quote}</p>}
            <div className="focus-actions">
              {mode === "work"
                ? <button className="side-btn" onClick={startBreak}><span className="ic"><Coffee size={22}/></span>Pausa</button>
                : <span className="side-btn" aria-hidden="true"/>}
              {mode === "work"
                ? <button className="round-btn" onClick={pauseTimer} aria-label="Metti in pausa il timer"><Pause size={32} fill="currentColor"/></button>
                : <button className="round-btn" onClick={resumeWork} aria-label={mode === "break" ? "Riparti con lo studio" : "Riprendi"}><Play size={32} fill="currentColor"/></button>}
              <button className="side-btn" onClick={finishSession}><span className="ic"><Square size={20}/></span>Chiudi</button>
            </div>
          </div>
        </div>
      )}

      {mode !== "idle" && !focusOpen && !isHome && (
        <div className="mini-player" role="button" tabIndex={0} onClick={() => setFocusOpen(true)} onKeyDown={(e) => { if (e.key === "Enter") setFocusOpen(true); }} aria-label="Apri la sessione in corso">
          <span className="mp-time">{formatTime(shown)}</span>
          <span className="mp-info"><b>{current?.title ?? "Sessione in corso"}</b><span>{timerLabel}</span></span>
          <button className="mp-btn" aria-label={mode === "work" ? "Pausa" : "Riprendi"} onClick={(e) => { e.stopPropagation(); if (mode === "work") pauseTimer(); else resumeWork(); }}>
            {mode === "work" ? <Pause size={20} fill="currentColor"/> : <Play size={20} fill="currentColor"/>}
          </button>
        </div>
      )}

      <nav className="bottom-nav" aria-label="Navigazione principale">
        <div className="bottom-nav-inner">
          <button className={view === "today" ? "nav-item active" : "nav-item"} onClick={() => setView("today")} aria-current={view === "today" ? "page" : undefined}><HomeIcon size={22}/>Oggi</button>
          <button className={view === "goals" ? "nav-item active" : "nav-item"} onClick={() => setView("goals")} aria-current={view === "goals" ? "page" : undefined}>
            <Building2 size={22}/>Città{(rewardReady || atRisk > 0) && <i className="nav-dot"/>}
          </button>
          <button className={view === "stats" ? "nav-item active" : "nav-item"} onClick={() => setView("stats")} aria-current={view === "stats" ? "page" : undefined}><BarChart3 size={22}/>Statistiche</button>
          <button className={showSettings ? "nav-item active" : "nav-item"} onClick={() => setShowSettings(true)}><Settings2 size={22}/>Impostazioni</button>
        </div>
      </nav>

      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button aria-label="Chiudi avviso" onClick={() => setNotice("")}><X size={16}/></button>
        </div>
      )}

      {celebrations[0] && (
        <div className="modal-backdrop" role="presentation" style={{ zIndex: 40 }}>
          <section className="settings-modal celebrate" role="alertdialog" aria-labelledby="celebrate-title">
            <p className="eyebrow">{celebrations[0].kind === "medal" ? "NUOVO EDIFICIO" : celebrations[0].kind === "level" ? "LIVELLO SUPERATO" : celebrations[0].kind === "reward" ? "PREMIO" : "SFIDA"}</p>
            {celebrations[0].kind === "medal" && <BuildingIcon icon={celebrations[0].icon!} tier={celebrations[0].tier!} size={150} pop/>}
            {celebrations[0].kind === "level" && <LevelBadge level={celebrations[0].level!} size={104}/>}
            {(celebrations[0].kind === "challenge" || celebrations[0].kind === "reward") && <span className="lvl-badge" style={{ width: 104, height: 104, margin: "18px auto 26px" }}><Gift size={46}/></span>}
            <h2 id="celebrate-title">{celebrations[0].title}</h2>
            <p className="subhead">{celebrations[0].text}</p>
            <button className="primary-btn dark full-btn" onClick={() => setCelebrations((q) => q.slice(1))}>{celebrations.length > 1 ? `Continua (${celebrations.length - 1} altre)` : "Continua"}</button>
          </section>
        </div>
      )}

      {blockedApp && mode === "work" && (
        <div className="modal-backdrop" role="presentation" style={{ zIndex: 30 }}>
          <section className="settings-modal blocked-card" role="alertdialog" aria-labelledby="blocked-title">
            <p className="eyebrow">BLOCCO DI STUDIO</p>
            <h2 id="blocked-title">{blockedApp} aspetta la pausa.</h2>
            <p className="subhead">Mancano {formatTime(remaining)}. Un compito alla volta: {current ? `“${current.title}”` : "resta su Filo"}.</p>
            {quotesOn && blockedQuote && <p className="quote">{blockedQuote}</p>}
            <button className="primary-btn dark full-btn" onClick={() => { resistedRef.current++; setBlockedApp(null); }}>Resto sul compito</button>
            <button className="danger-link" onClick={() => void needTwoMinutes()}>Mi servono 2 minuti</button>
          </section>
        </div>
      )}

      {showApps && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowApps(false); }}>
          <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="apps-title">
            <div className="modal-head">
              <div><p className="eyebrow">DISTRAZIONI</p><h2 id="apps-title">Quali app blocchiamo?</h2></div>
              <button className="icon-btn" onClick={() => setShowApps(false)} aria-label="Chiudi"><X size={18}/></button>
            </div>
            <input className="app-search" value={appSearch} onChange={(e) => setAppSearch(e.target.value)} placeholder="Cerca un’app…" aria-label="Cerca un’app"/>
            <div className="app-list">
              {installed
                .filter((a) => a.label.toLowerCase().includes(appSearch.trim().toLowerCase()))
                .map((a) => (
                  <label className="preview-row" key={a.package}>
                    <input type="checkbox" checked={guardApps.includes(a.package)} onChange={() => void toggleGuardApp(a.package)}/>
                    <span><strong>{a.label}</strong></span>
                  </label>
                ))}
            </div>
            <button className="primary-btn dark full-btn" onClick={() => setShowApps(false)}>Fatto ({guardApps.length} app)</button>
          </section>
        </div>
      )}

      {showSettings && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}>
          <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <div className="modal-head">
              <div><p className="eyebrow">PROGRAMMA</p><h2 id="settings-title">Quanto lavoro hai oggi?</h2></div>
              <button className="icon-btn" onClick={() => setShowSettings(false)} aria-label="Chiudi"><X size={18}/></button>
            </div>
            <div className="settings-block">
              <strong>Aspetto</strong>
              <div className="segmented" role="radiogroup" aria-label="Tema dell'app">
                {(["auto", "light", "dark"] as const).map((t) => (
                  <button key={t} role="radio" aria-checked={theme === t} className={theme === t ? "on" : ""} onClick={() => changeTheme(t)}>
                    {t === "auto" ? "Automatico" : t === "light" ? "Chiaro" : "Scuro"}
                  </button>
                ))}
              </div>
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
            {native && guardAvailable && (
              <div className="guard-box">
                <div className="notification-row">
                  <div>
                    <strong>Blocca le distrazioni</strong>
                    <span>Durante i blocchi di studio, se apri una delle app che scegli (social, messaggi, video) torni a Filo. Nelle pause sono libere.</span>
                  </div>
                  <button className={guardOn ? "toggle on" : "toggle"} role="switch" aria-checked={guardOn} aria-label="Blocca le distrazioni" type="button"
                    disabled={!guardService} onClick={() => void saveGuard(!guardOn, guardApps)}><span/></button>
                </div>
                {!guardService ? (
                  <div className="guard-help">
                    <p><strong>Prima serve un permesso.</strong> In Android: Impostazioni → Accessibilità → Filo → Attiva. Il servizio vede solo il nome dell’app aperta, non legge messaggi né schermo.</p>
                    <p>Se l’interruttore è grigio: “Info app” di Filo → menu ⋮ → <em>Consenti impostazioni con restrizioni</em>, poi riprova.</p>
                    <div className="advance-actions">
                      <button className="install-go" onClick={() => void openAccessibilitySettings()}>Apri Accessibilità</button>
                      <button className="secondary-light" onClick={() => void openAppInfo()}>Info app</button>
                    </div>
                  </div>
                ) : (
                  <button className="secondary-light" onClick={() => void openAppPicker()}>Scegli le app da bloccare ({guardApps.length})</button>
                )}
              </div>
            )}
            <div className="notification-row">
              <div><strong>Frasi motivazionali</strong><span>Una frase breve all’inizio di blocchi e pause, a fine sessione e quando chiudi un compito.</span></div>
              <button className={quotesOn ? "toggle on" : "toggle"} onClick={toggleQuotes} type="button" role="switch" aria-checked={quotesOn} aria-label="Frasi motivazionali"><span/></button>
            </div>
            <div className="notification-row">
              <div><strong>Celebrazioni e animazioni</strong><span>Nuovi edifici, livelli e sfide con una piccola festa. Se spento, solo un messaggio.</span></div>
              <button className={celebrateOn ? "toggle on" : "toggle"} onClick={toggleCelebrate} type="button" role="switch" aria-checked={celebrateOn} aria-label="Celebrazioni e animazioni"><span/></button>
            </div>
            <div className="reward-edit">
              <strong>Il tuo premio</strong>
              <span>Qualcosa di vero che ti piace: te lo ricordo io quando completi le sfide della settimana.</span>
              <input value={reward.text} maxLength={60} placeholder="es. Serata film, gelato, 1 ora di gioco…" aria-label="Premio personale" onChange={(e) => void changeReward({ ...reward, text: e.target.value })}/>
              <label>Sfide da completare ogni settimana:
                <select value={reward.need} aria-label="Sfide necessarie" onChange={(e) => void changeReward({ ...reward, need: Number(e.target.value) })}>
                  <option value={1}>1</option><option value={2}>2</option><option value={3}>3 (tutte)</option>
                </select>
              </label>
            </div>
            <div className="sound-test">
              <strong>Suoni</strong>
              <div className="advance-actions">
                <button type="button" className="chip" onClick={() => { unlockAudio(); window.setTimeout(() => chime("start"), 60); }}>▶ Inizio attività</button>
                <button type="button" className="chip" onClick={() => { unlockAudio(); window.setTimeout(() => chime("rest"), 60); }}>▶ Inizio pausa</button>
              </div>
            </div>
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
            <p className="privacy-note">I tuoi dati restano su questo dispositivo. Nessun account.</p>
          </section>
        </div>
      )}
    </main>
  );
}
