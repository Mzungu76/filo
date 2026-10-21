import type { Task } from "./db";

export type Level = "few" | "medium" | "many";
export type Preset = "auto" | Level;
export type Plan = { level: Level; work: number; rest: number };

export const LEVELS: Record<Level, { label: string; work: number; rest: number; hint: string }> = {
  few: { label: "Pochi", work: 25, rest: 5, hint: "Pochi compiti: blocchi un po’ più lunghi, pausa breve." },
  medium: { label: "Medi", work: 20, rest: 10, hint: "Carico normale: il programma suggerito." },
  many: { label: "Tanti", work: 15, rest: 5, hint: "Tanti compiti: blocchi corti e leggeri per partire senza fatica." }
};

/** Peso di un compito: più è lungo il testo e più sono gli esercizi citati, più lavoro richiede. */
function weight(task: Task) {
  const length = task.title.length;
  const items = (task.title.match(/\d+/g) ?? []).length;
  return (length > 120 ? 3 : length > 60 ? 2 : 1) + Math.min(2, Math.floor(items / 3));
}

/**
 * Carico da affrontare (compiti in scadenza entro domani, scaduti o senza data):
 * somma dei pesi, più un punto per ogni materia oltre la prima, perché cambiare materia costa fatica.
 */
export function workloadScore(tasks: Task[], now = Date.now()) {
  const limit = new Date(now);
  limit.setHours(0, 0, 0, 0);
  limit.setDate(limit.getDate() + 1);
  const due = tasks.filter((t) => t.status === "todo" && (t.dueDate === undefined || t.dueDate <= limit.getTime()));
  const subjects = new Set(due.map((t) => t.subject ?? "-"));
  return due.reduce((sum, t) => sum + weight(t), 0) + Math.max(0, subjects.size - 1);
}

export function levelFor(score: number): Level {
  return score <= 3 ? "few" : score <= 7 ? "medium" : "many";
}

export function planFor(preset: Preset, tasks: Task[], now = Date.now()): Plan {
  const level = preset === "auto" ? levelFor(workloadScore(tasks, now)) : preset;
  return { level, work: LEVELS[level].work, rest: LEVELS[level].rest };
}
