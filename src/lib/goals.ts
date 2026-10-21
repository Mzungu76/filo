import type { StudySession, Task } from "./db";
import { startOfDay, weekStart } from "./stats";

const DAY = 24 * 3600 * 1000;
const WEEK = 7 * DAY;

/** 0 = non ottenuta, 1 bronzo, 2 argento, 3 oro, 4 platino, 5 diamante. */
export type Tier = 0 | 1 | 2 | 3 | 4 | 5;
export const TIER_NAMES = ["Da costruire", "Livello 1", "Livello 2", "Livello 3", "Livello 4", "Livello 5"];
/** Le medaglie contano quello che fai nelle ultime 4 settimane: vanno mantenute. */
export const WINDOW_DAYS = 28;
export type MedalIcon =
  | "hourglass" | "clock" | "calendar" | "week" | "link" | "shield" | "undo"
  | "mountain" | "target" | "list" | "rocket" | "moon" | "layers";

export type Metrics = {
  blocks: number; minutes: number; studyDays: number; bestWeekDays: number;
  bestStreak: number; curStreak: number; cleanSessions: number; resisted: number;
  longestRun: number; daysThisWeek: number; onTime: number; closed: number; early: number; sleepDays: number; subjectsWeek: number;
};

export type MedalDef = {
  id: string;
  name: string;
  icon: MedalIcon;
  family: "Costanza" | "Efficacia" | "Organizzazione" | "Equilibrio" | "Impegno";
  /** 5 soglie a crescita rapida: le prime vicine, le ultime molto più impegnative. */
  tiers: number[];
  unit: string;
  /** Cosa serve per ottenerla, nel formato "{n} …". */
  how: (n: number) => string;
  /** Perché conta, in una riga. */
  why: string;
  value: (m: Metrics) => number;
};

export const MEDALS: MedalDef[] = [
  { id: "blocks", name: "Blocchi completati", icon: "hourglass", family: "Impegno", tiers: [3, 10, 25, 50, 90], unit: "blocchi",
    how: (n) => `Completa ${n} blocchi di studio fino alla fine`, why: "Un blocco finito vale più di tre iniziati.", value: (m) => m.blocks },
  { id: "hours", name: "Ore guadagnate", icon: "clock", family: "Impegno", tiers: [120, 360, 840, 1680, 3000], unit: "min",
    how: (n) => `Accumula ${Math.round(n / 60)} ore di studio`, why: "Il tempo si somma, anche a piccoli pezzi.", value: (m) => m.minutes },
  { id: "days", name: "Presenza", icon: "calendar", family: "Costanza", tiers: [3, 7, 12, 18, 24], unit: "giorni",
    how: (n) => `Studia in ${n} giorni diversi`, why: "Esserci conta più dell'intensità.", value: (m) => m.studyDays },
  { id: "week", name: "Settimana piena", icon: "week", family: "Costanza", tiers: [2, 3, 4, 5, 6], unit: "giorni",
    how: (n) => `Studia ${n} giorni nella stessa settimana`, why: "Poco ogni giorno batte tanto un giorno solo.", value: (m) => m.bestWeekDays },
  { id: "streak", name: "Non perdere il filo", icon: "link", family: "Costanza", tiers: [1, 2, 4, 8, 16], unit: "settimane",
    how: (n) => `${n} ${n === 1 ? "settimana" : "settimane"} di fila con almeno 3 giorni di studio`, why: "La costanza si costruisce a settimane, non a giorni perfetti.", value: (m) => m.curStreak },
  { id: "clean", name: "Blocco pulito", icon: "shield", family: "Efficacia", tiers: [1, 4, 10, 20, 36], unit: "sessioni",
    how: (n) => `Fai ${n} ${n === 1 ? "sessione" : "sessioni"} senza aprire app bloccate`, why: "Studio senza interruzioni: quello che rende davvero.", value: (m) => m.cleanSessions },
  { id: "resist", name: "Rientro", icon: "undo", family: "Efficacia", tiers: [1, 5, 15, 40, 100], unit: "volte",
    how: (n) => `Resta sul compito ${n} ${n === 1 ? "volta" : "volte"} dopo aver aperto un'app bloccata`, why: "Resistere alla distrazione si allena: ogni volta costa meno.", value: (m) => m.resisted },
  { id: "marathon", name: "Maratona", icon: "mountain", family: "Efficacia", tiers: [2, 3, 4, 6, 8], unit: "blocchi",
    how: (n) => `${n} blocchi di fila in una sola sessione`, why: "Restare nel flusso è un'abilità.", value: (m) => m.longestRun },
  { id: "ontime", name: "Puntuale", icon: "target", family: "Organizzazione", tiers: [2, 6, 14, 30, 60], unit: "compiti",
    how: (n) => `Chiudi ${n} compiti entro la scadenza`, why: "Arrivare in tempo toglie ansia.", value: (m) => m.onTime },
  { id: "closed", name: "Compiti chiusi", icon: "list", family: "Organizzazione", tiers: [3, 8, 18, 38, 75], unit: "compiti",
    how: (n) => `Chiudi ${n} compiti`, why: "Ogni spunta è una prova concreta che ce la fai.", value: (m) => m.closed },
  { id: "early", name: "Anticipo", icon: "rocket", family: "Organizzazione", tiers: [1, 3, 7, 15, 30], unit: "compiti",
    how: (n) => `Chiudi ${n} ${n === 1 ? "compito" : "compiti"} almeno 3 giorni prima della scadenza`, why: "Anticipare regala tempo libero più avanti.", value: (m) => m.early },
  { id: "sleep", name: "Sonno protetto", icon: "moon", family: "Equilibrio", tiers: [3, 8, 14, 20, 26], unit: "giorni",
    how: (n) => `Finisci di studiare prima delle 22 per ${n} giorni`, why: "Dormire bene fissa ciò che hai imparato.", value: (m) => m.sleepDays },
  { id: "allround", name: "Tuttofare", icon: "layers", family: "Equilibrio", tiers: [2, 3, 4, 5, 6], unit: "materie",
    how: (n) => `Studia ${n} materie diverse nella stessa settimana`, why: "Non lasciare indietro nessuna materia.", value: (m) => m.subjectsWeek }
];

export const blocksOf = (s: StudySession) => s.blocks ?? Math.floor(s.workMinutes / 15);
const legit = (t: Task) => t.status === "done" && !!t.completedAt && t.completedAt - t.createdAt >= 60000; // niente spunte istantanee

export function computeMetrics(allSessions: StudySession[], allTasks: Task[], now: number): Metrics {
  // Tutto, tranne la serie settimanale, conta solo le ultime 4 settimane (finestra mobile).
  const from = startOfDay(now) - (WINDOW_DAYS - 1) * DAY;
  const sessions = allSessions.filter((s) => s.startedAt >= from);
  const tasks = allTasks.filter((t) => t.status !== "done" || (t.completedAt ?? 0) >= from);
  const dayKeys = new Set(sessions.map((s) => startOfDay(s.startedAt)));
  const weeks = new Map<number, { days: Set<number>; subjects: Set<string> }>();
  const allWeeks = new Map<number, Set<number>>();
  for (const s of allSessions) {
    const w = weekStart(s.startedAt);
    if (!allWeeks.has(w)) allWeeks.set(w, new Set());
    allWeeks.get(w)!.add(startOfDay(s.startedAt));
  }
  for (const s of sessions) {
    const w = weekStart(s.startedAt);
    if (!weeks.has(w)) weeks.set(w, { days: new Set(), subjects: new Set() });
    weeks.get(w)!.days.add(startOfDay(s.startedAt));
    for (const name of Object.keys(s.subjectMinutes ?? {})) weeks.get(w)!.subjects.add(name);
  }
  const qualifying = [...allWeeks.entries()].filter(([, v]) => v.size >= 3).map(([w]) => Math.round(w / WEEK)).sort((a, b) => a - b);
  let bestStreak = 0, run = 0;
  qualifying.forEach((w, i) => { run = i > 0 && w === qualifying[i - 1] + 1 ? run + 1 : 1; bestStreak = Math.max(bestStreak, run); });
  const thisW = Math.round(weekStart(now) / WEEK);
  const set = new Set(qualifying);
  let curStreak = 0;
  for (let w = set.has(thisW) ? thisW : thisW - 1; set.has(w); w--) curStreak++;

  const lastEndByDay = new Map<number, number>();
  for (const s of sessions) {
    const d = startOfDay(s.startedAt);
    lastEndByDay.set(d, Math.max(lastEndByDay.get(d) ?? 0, new Date(s.endedAt).getHours() + (new Date(s.endedAt).getDate() !== new Date(s.startedAt).getDate() ? 24 : 0)));
  }
  const done = tasks.filter(legit);
  return {
    blocks: sessions.reduce((n, s) => n + blocksOf(s), 0),
    minutes: sessions.reduce((n, s) => n + s.workMinutes, 0),
    studyDays: dayKeys.size,
    bestWeekDays: Math.max(0, ...[...weeks.values()].map((v) => v.days.size)),
    bestStreak, curStreak,
    cleanSessions: sessions.filter((s) => s.workMinutes >= 20 && blocksOf(s) >= 1 && s.distractions === 0).length,
    resisted: sessions.reduce((n, s) => n + (s.resisted ?? 0), 0),
    longestRun: Math.max(0, ...sessions.map(blocksOf)),
    daysThisWeek: allWeeks.get(weekStart(now))?.size ?? 0,
    onTime: done.filter((t) => t.dueDate !== undefined && t.completedAt! < t.dueDate + DAY).length,
    closed: done.length,
    early: done.filter((t) => t.dueDate !== undefined && t.dueDate - startOfDay(t.completedAt!) >= 3 * DAY).length,
    sleepDays: [...lastEndByDay.values()].filter((h) => h < 22).length,
    subjectsWeek: Math.max(0, ...[...weeks.values()].map((v) => v.subjects.size))
  };
}

export type MedalState = { def: MedalDef; value: number; tier: Tier; next: number | null; pct: number; futureValue: number; riskNeed: number | null };

/**
 * Stato di ogni medaglia. `future` = le stesse misure tra 7 giorni senza nuova attività:
 * se scenderebbero sotto la soglia attuale, la medaglia è "a rischio" e `riskNeed` dice quanto serve per mantenerla.
 */
export function medalStates(m: Metrics, future?: Metrics): MedalState[] {
  const tierAt = (def: MedalDef, value: number) => def.tiers.filter((t) => value >= t).length as Tier;
  return MEDALS.map((def) => {
    const value = def.value(m);
    const tier = tierAt(def, value);
    const last = def.tiers.length;
    const next = tier < last ? def.tiers[tier] : null;
    const from = tier === 0 ? 0 : def.tiers[tier - 1];
    const pct = next === null ? 100 : Math.max(0, Math.min(100, Math.round(((value - from) / (next - from)) * 100)));
    const futureValue = future ? def.value(future) : value;
    const riskNeed = tier > 0 && tierAt(def, futureValue) < tier ? def.tiers[tier - 1] - futureValue : null;
    return { def, value, tier, next, pct, futureValue, riskNeed };
  });
}

// ---- Punti e livelli ----

// Scala esponenziale: i primi livelli arrivano in fretta, poi ogni passo costa il doppio circa.
export const LEVELS = [
  { name: "Esordiente", at: 0 }, { name: "Apprendista", at: 25 }, { name: "Costante", at: 70 }, { name: "Concentrato", at: 160 },
  { name: "Metodico", at: 350 }, { name: "Esperto", at: 750 }, { name: "Stratega", at: 1550 }, { name: "Maestro", at: 3200 },
  { name: "Fuoriclasse", at: 6500 }, { name: "Leggenda", at: 13000 }
];

/**
 * Punti: 10 per blocco completo (max 6 al giorno), +5 per ogni blocco "pulito" senza interruzioni,
 * 5 per compito chiuso (+3 se in tempo), più i bonus delle sfide settimanali.
 */
export function computePoints(sessions: StudySession[], tasks: Task[], bonus: number, now: number) {
  const days = new Map<number, { blocks: number; clean: number }>();
  for (const s of sessions) {
    const d = startOfDay(s.startedAt);
    const row = days.get(d) ?? { blocks: 0, clean: 0 };
    row.blocks += blocksOf(s);
    if (s.distractions === 0) row.clean += blocksOf(s);
    days.set(d, row);
  }
  const dayPoints = (r: { blocks: number; clean: number }) => {
    const counted = Math.min(6, r.blocks);
    return counted * 10 + Math.min(counted, r.clean) * 5;
  };
  const taskPoints = (t: Task) => 5 + (t.dueDate !== undefined && t.completedAt! < t.dueDate + DAY ? 3 : 0);
  const today = startOfDay(now);
  const done = tasks.filter(legit);
  const total = [...days.values()].reduce((n, r) => n + dayPoints(r), 0) + done.reduce((n, t) => n + taskPoints(t), 0) + bonus;
  const todayPts = (days.has(today) ? dayPoints(days.get(today)!) : 0) + done.filter((t) => startOfDay(t.completedAt!) === today).reduce((n, t) => n + taskPoints(t), 0);
  return { total, today: todayPts };
}

export function levelOf(points: number) {
  let i = 0;
  while (i + 1 < LEVELS.length && points >= LEVELS[i + 1].at) i++;
  const next = LEVELS[i + 1];
  const pct = next ? Math.round(((points - LEVELS[i].at) / (next.at - LEVELS[i].at)) * 100) : 100;
  return { level: i + 1, name: LEVELS[i].name, nextName: next?.name ?? null, toNext: next ? next.at - points : 0, pct };
}

/** Ritmo: quanto studio negli ultimi 14 giorni. Cala piano se ti fermi e risale con un blocco. */
export function rhythm(sessions: StudySession[], now: number) {
  const from = startOfDay(now) - 13 * DAY;
  const days = new Set(sessions.filter((s) => s.startedAt >= from).map((s) => startOfDay(s.startedAt))).size;
  const score = Math.round(Math.min(1, days / 8) * 100);
  const label = score >= 85 ? "Ottimo" : score >= 55 ? "Buono" : score >= 25 ? "In calo" : "Da riaccendere";
  return { score, days, label };
}

// ---- Sfide settimanali ----

export type ChallengeKind = "days" | "tasks" | "overdue" | "minutes" | "run";
export type Challenge = { id: string; kind: ChallengeKind; title: string; target: number; baseline: number };
export type ChallengePlan = { week: number; items: Challenge[]; doneIds: string[] };

export function planChallenges(sessions: StudySession[], tasks: Task[], now: number): ChallengePlan {
  const week = weekStart(now);
  const prevFrom = week - WEEK;
  const prev = sessions.filter((s) => s.startedAt >= prevFrom && s.startedAt < week);
  const prevDays = new Set(prev.map((s) => startOfDay(s.startedAt))).size;
  const prevMinutes = prev.reduce((n, s) => n + s.workMinutes, 0);
  const open = tasks.filter((t) => t.status === "todo");
  const overdue = open.filter((t) => t.dueDate !== undefined && t.dueDate < startOfDay(now)).length;
  const items: Challenge[] = [];
  const dTarget = prevDays >= 4 ? 4 : 3;
  items.push({ id: `${week}-days`, kind: "days", title: `Studia ${dTarget} giorni`, target: dTarget, baseline: 0 });
  const optional: Challenge[] = [];
  if (overdue > 0) optional.push({ id: `${week}-overdue`, kind: "overdue", title: overdue === 1 ? "Chiudi il compito scaduto" : `Chiudi ${overdue} compiti scaduti`, target: overdue, baseline: overdue });
  if (open.length > 0) { const t = Math.min(3, open.length); optional.push({ id: `${week}-tasks`, kind: "tasks", title: `Chiudi ${t} ${t === 1 ? "compito" : "compiti"}`, target: t, baseline: 0 }); }
  const mTarget = prevMinutes >= 30 ? Math.round((prevMinutes + 5) / 5) * 5 : 60;
  optional.push({ id: `${week}-minutes`, kind: "minutes", title: prevMinutes >= 30 ? `Supera la scorsa settimana (${mTarget} min)` : "Studia 60 minuti", target: mTarget, baseline: 0 });
  optional.push({ id: `${week}-run`, kind: "run", title: "Due blocchi di fila in una sessione", target: 1, baseline: 0 });
  return { week, items: [...items, ...optional.slice(0, 2)], doneIds: [] };
}

export function challengeProgress(c: Challenge, sessions: StudySession[], tasks: Task[], now: number): number {
  const week = weekStart(now);
  const inWeek = sessions.filter((s) => s.startedAt >= week);
  const value =
    c.kind === "days" ? new Set(inWeek.map((s) => startOfDay(s.startedAt))).size
    : c.kind === "minutes" ? inWeek.reduce((n, s) => n + s.workMinutes, 0)
    : c.kind === "run" ? inWeek.filter((s) => blocksOf(s) >= 2).length
    : c.kind === "tasks" ? tasks.filter((t) => legit(t) && t.completedAt! >= week).length
    : Math.max(0, c.baseline - tasks.filter((t) => t.status === "todo" && t.dueDate !== undefined && t.dueDate < startOfDay(now)).length);
  return Math.min(c.target, value);
}
