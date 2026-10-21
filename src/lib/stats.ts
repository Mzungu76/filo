import type { StudySession, Task } from "./db";

const DAY = 24 * 3600 * 1000;
const WEEKDAYS = ["D", "L", "M", "M", "G", "V", "S"];

export type DayBar = { date: number; label: string; minutes: number; isToday: boolean };
export type Bucket = { key: "morning" | "afternoon" | "evening" | "night"; label: string; range: string; minutes: number };
export type SubjectRow = { subject: string; minutes: number; done: number; open: number };
export type Tip = { id: string; tone: "improve" | "praise"; title: string; text: string };
export type Stats = {
  hasData: boolean;
  week: { minutes: number; prevMinutes: number; sessions: number; activeDays: number; elapsedDays: number; doneTasks: number };
  bars: DayBar[];
  buckets: Bucket[];
  bestBucket: Bucket | null;
  subjects: SubjectRow[];
  tasks: { onTimePct: number | null; doneWithDue: number; overdueOpen: number; dueSoon: number };
  focus: { avgSessionMin: number | null; avgBlocks: number | null; distractionsPerSession: number | null };
  tips: Tip[];
};

export function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
export function weekStart(ts: number) {
  const d = new Date(startOfDay(ts));
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : null);
const round1 = (n: number) => Math.round(n * 10) / 10;

export function computeStats(sessions: StudySession[], tasks: Task[], now: number, startTime: string): Stats {
  const today = startOfDay(now);
  const thisWeek = weekStart(now);
  const elapsedDays = Math.round((today - thisWeek) / DAY) + 1;
  const prevWeek = thisWeek - 7 * DAY;

  const inRange = (s: StudySession, from: number, to: number) => s.startedAt >= from && s.startedAt < to;
  const weekSessions = sessions.filter((s) => inRange(s, thisWeek, today + DAY));
  const prevSessions = sessions.filter((s) => inRange(s, prevWeek, prevWeek + elapsedDays * DAY));
  const minutes = sum(weekSessions.map((s) => s.workMinutes));
  const prevMinutes = sum(prevSessions.map((s) => s.workMinutes));
  const activeDays = new Set(weekSessions.map((s) => startOfDay(s.startedAt))).size;
  const doneTasks = tasks.filter((t) => t.status === "done" && t.completedAt && t.completedAt >= thisWeek).length;

  // Ultimi 7 giorni
  const bars: DayBar[] = Array.from({ length: 7 }, (_, i) => {
    const date = today - (6 - i) * DAY;
    const mins = sum(sessions.filter((s) => startOfDay(s.startedAt) === date).map((s) => s.workMinutes));
    return { date, label: WEEKDAYS[new Date(date).getDay()], minutes: mins, isToday: date === today };
  });

  // Quando si studia: ultime 4 settimane, in base all'ora di inizio
  const recent = sessions.filter((s) => s.startedAt >= today - 27 * DAY);
  const bucketDefs: Omit<Bucket, "minutes">[] = [
    { key: "morning", label: "Mattina", range: "fino alle 13" },
    { key: "afternoon", label: "Pomeriggio", range: "13–18" },
    { key: "evening", label: "Sera", range: "18–22" },
    { key: "night", label: "Notte", range: "dopo le 22" }
  ];
  const bucketOf = (h: number): Bucket["key"] => (h >= 22 || h < 5 ? "night" : h < 13 ? "morning" : h < 18 ? "afternoon" : "evening");
  const buckets: Bucket[] = bucketDefs.map((b) => ({
    ...b,
    minutes: sum(recent.filter((s) => bucketOf(new Date(s.startedAt).getHours()) === b.key).map((s) => s.workMinutes))
  }));
  const bucketTotal = sum(buckets.map((b) => b.minutes));
  const best = [...buckets].sort((a, b) => b.minutes - a.minutes)[0];
  const bestBucket = bucketTotal > 0 && best.minutes > 0 ? best : null;

  // Materie (settimana corrente)
  const rows = new Map<string, SubjectRow>();
  const row = (name: string) => {
    if (!rows.has(name)) rows.set(name, { subject: name, minutes: 0, done: 0, open: 0 });
    return rows.get(name)!;
  };
  for (const s of weekSessions) for (const [name, m] of Object.entries(s.subjectMinutes ?? {})) row(name).minutes += m;
  for (const t of tasks) {
    const name = t.subject ?? "Altro";
    if (t.status === "todo") row(name).open++;
    else if (t.completedAt && t.completedAt >= thisWeek) row(name).done++;
  }
  const subjects = [...rows.values()]
    .filter((r) => r.minutes > 0 || r.open > 0 || r.done > 0)
    .sort((a, b) => b.minutes - a.minutes || b.open - a.open)
    .slice(0, 6);

  // Compiti
  const doneRecent = tasks.filter((t) => t.status === "done" && t.completedAt && t.completedAt >= today - 13 * DAY && t.dueDate !== undefined);
  const onTime = doneRecent.filter((t) => t.completedAt! < t.dueDate! + DAY).length;
  const onTimePct = doneRecent.length ? Math.round((onTime / doneRecent.length) * 100) : null;
  const open = tasks.filter((t) => t.status === "todo");
  const overdueOpen = open.filter((t) => t.dueDate !== undefined && t.dueDate < today).length;
  const dueSoon = open.filter((t) => t.dueDate !== undefined && t.dueDate >= today && t.dueDate <= today + DAY).length;

  // Concentrazione (ultime due settimane)
  const lately = sessions.filter((s) => s.startedAt >= today - 13 * DAY);
  const avgSessionMin = avg(lately.map((s) => s.workMinutes));
  const blocks = lately.filter((s) => s.blocks !== undefined).map((s) => s.blocks!);
  const distr = lately.filter((s) => s.distractions !== undefined).map((s) => s.distractions!);

  const stats: Stats = {
    hasData: sessions.length > 0,
    week: { minutes, prevMinutes, sessions: weekSessions.length, activeDays, elapsedDays, doneTasks },
    bars, buckets, bestBucket, subjects,
    tasks: { onTimePct, doneWithDue: doneRecent.length, overdueOpen, dueSoon },
    focus: {
      avgSessionMin: avgSessionMin === null ? null : Math.round(avgSessionMin),
      avgBlocks: avg(blocks) === null ? null : round1(avg(blocks)!),
      distractionsPerSession: avg(distr) === null ? null : round1(avg(distr)!)
    },
    tips: []
  };
  stats.tips = buildTips(stats, startTime, bucketTotal, lately.length);
  return stats;
}

function buildTips(s: Stats, startTime: string, bucketTotal: number, recentSessions: number): Tip[] {
  const improve: Tip[] = [];
  const praise: Tip[] = [];
  const w = s.week;

  if (w.sessions === 0 && w.elapsedDays >= 2 && s.hasData) {
    improve.push({ id: "restart", tone: "improve", title: "Riparti in piccolo",
      text: "Questa settimana non hai ancora fatto sessioni. Basta un blocco da 15 minuti sul compito più piccolo: la parte difficile è solo iniziare." });
  }
  if (w.prevMinutes >= 60 && w.minutes < w.prevMinutes * 0.6 && w.sessions > 0) {
    improve.push({ id: "drop", tone: "improve", title: "Ritmo in calo",
      text: `Finora hai studiato ${w.minutes} min contro ${w.prevMinutes} nello stesso periodo della scorsa settimana. Se la settimana è piena, accorcia i blocchi invece di saltarli: anche 15 minuti contano.` });
  }
  if (w.elapsedDays >= 4 && w.activeDays <= 2 && w.minutes > 0) {
    improve.push({ id: "spread", tone: "improve", title: "Distribuisci lo studio",
      text: `Hai studiato solo ${w.activeDays} giorni su ${w.elapsedDays}. Tre giorni da 20 minuti rendono più di uno da un'ora: la memoria ama la ripetizione.` });
  }
  const night = s.buckets.find((b) => b.key === "night")!;
  if (bucketTotal >= 90 && night.minutes / bucketTotal >= 0.25) {
    improve.push({ id: "late", tone: "improve", title: "Studi molto tardi",
      text: `Il ${Math.round((night.minutes / bucketTotal) * 100)}% del tuo studio è dopo le 22. Dormire bene fissa ciò che hai imparato: prova a spostare un blocco prima di cena.` });
  }
  if (s.tasks.overdueOpen > 0) {
    improve.push({ id: "overdue", tone: "improve", title: "Compiti scaduti",
      text: `Hai ${s.tasks.overdueOpen} ${s.tasks.overdueOpen === 1 ? "compito scaduto" : "compiti scaduti"}. Scegline uno piccolo e chiudilo oggi: togliere il più vecchio alleggerisce subito.` });
  }
  if (s.tasks.onTimePct !== null && s.tasks.doneWithDue >= 4 && s.tasks.onTimePct < 70) {
    improve.push({ id: "late-tasks", tone: "improve", title: "Scadenze",
      text: `Chiudi in tempo il ${s.tasks.onTimePct}% dei compiti con scadenza. Inserisci sempre la data e parti da quello che scade per primo.` });
  }
  if (s.focus.distractionsPerSession !== null && s.focus.distractionsPerSession >= 3) {
    improve.push({ id: "distractions", tone: "improve", title: "Troppe interruzioni",
      text: `Provi ad aprire app bloccate circa ${s.focus.distractionsPerSession} volte a sessione. È normale: prova blocchi più corti (preset “Tanti”) e tieni il telefono lontano dalla scrivania.` });
  }
  if (s.focus.avgSessionMin !== null && s.focus.avgSessionMin < 12 && recentSessions >= 3) {
    improve.push({ id: "short", tone: "improve", title: "Sessioni molto brevi",
      text: `In media chiudi la sessione dopo ${s.focus.avgSessionMin} minuti. Prova a completare almeno un blocco intero: i primi 10 minuti sono i più difficili, poi si scorre.` });
  }
  const neglected = s.subjects.find((r) => r.minutes === 0 && r.open >= 2 && r.subject !== "Altro");
  if (neglected && w.minutes >= 60) {
    improve.push({ id: "neglected", tone: "improve", title: "Una materia è rimasta indietro",
      text: `${neglected.subject} ha ${neglected.open} compiti aperti, ma questa settimana non le hai dedicato tempo. Parti da quello più corto.` });
  }

  if (w.prevMinutes >= 30 && w.minutes >= w.prevMinutes * 1.15) {
    praise.push({ id: "growth", tone: "praise", title: "In crescita",
      text: `+${Math.round(((w.minutes - w.prevMinutes) / w.prevMinutes) * 100)}% rispetto allo stesso periodo della scorsa settimana. Non è fortuna: è costanza.` });
  }
  if (w.activeDays >= 5) {
    praise.push({ id: "steady", tone: "praise", title: "Costanza",
      text: `Hai studiato ${w.activeDays} giorni su ${w.elapsedDays}. La regolarità conta più dell'intensità.` });
  }
  if (s.tasks.onTimePct !== null && s.tasks.doneWithDue >= 4 && s.tasks.onTimePct >= 90) {
    praise.push({ id: "ontime", tone: "praise", title: "Puntuale",
      text: `Chiudi in tempo il ${s.tasks.onTimePct}% dei compiti con scadenza: sai organizzarti.` });
  }
  if (s.focus.distractionsPerSession !== null && s.focus.distractionsPerSession <= 1 && recentSessions >= 3) {
    praise.push({ id: "focus", tone: "praise", title: "Concentrazione solida",
      text: "Quasi nessuna interruzione nelle ultime sessioni: stai proteggendo bene il tuo tempo." });
  }
  if (s.bestBucket && bucketTotal >= 90 && s.bestBucket.minutes / bucketTotal >= 0.4 && s.bestBucket.key !== "night") {
    const hour = Number(startTime.split(":")[0]);
    const inside = s.bestBucket.key === "morning" ? hour < 13 : s.bestBucket.key === "afternoon" ? hour >= 13 && hour < 18 : hour >= 18 && hour < 22;
    praise.push({ id: "best-time", tone: "praise", title: `Il tuo momento: ${s.bestBucket.label.toLowerCase()}`,
      text: `Studi soprattutto di ${s.bestBucket.label.toLowerCase()} (${s.bestBucket.range}), il ${Math.round((s.bestBucket.minutes / bucketTotal) * 100)}% del tempo. Metti lì i compiti più difficili.${inside ? "" : ` Il promemoria è alle ${startTime}: puoi spostarlo nelle impostazioni.`}` });
  }
  return [...improve.slice(0, 3), ...praise.slice(0, 2)];
}
