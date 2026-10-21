export type ParsedTask = { title: string; subject?: string; dueDate?: number };

const MONTHS: Record<string, number> = {
  gennaio: 0, febbraio: 1, marzo: 2, aprile: 3, maggio: 4, giugno: 5,
  luglio: 6, agosto: 7, settembre: 8, ottobre: 9, novembre: 10, dicembre: 11
};
const LANGUAGES = ["spagnolo", "tedesco", "inglese", "francese", "russo", "cinese", "portoghese"];

const HEADER = /^da consegnare\s+(?:[\p{L}]+\s+)?(\d{1,2})\s+([\p{L}]+)/iu;
const ASSIGNED_IN = /^assegnato in\b/i;
const ASSIGNED_ON = /^assegnato il\b/i;
const NOISE = /^(home|menu|diario|attivit[àa]|compiti|mattia|\d{1,2}:\d{2}|[\p{L}]+ \d{4})$/iu;

function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function parseDue(day: string, monthName: string, now: number): number | undefined {
  const month = MONTHS[monthName.toLowerCase()];
  if (month === undefined) return undefined;
  const today = new Date(now);
  let due = new Date(today.getFullYear(), month, Number(day)).getTime();
  // Una data molto nel passato si riferisce all'anno scolastico successivo.
  if (due < startOfDay(now) - 180 * 24 * 3600 * 1000) {
    due = new Date(today.getFullYear() + 1, month, Number(day)).getTime();
  }
  return due;
}

function sentenceCase(s: string) {
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function prettySubject(raw: string) {
  const s = raw.replace(/[….]+$/, "").replace(/\s+/g, " ").trim();
  const foreign = s.match(/^lingua e cultura straniera\s*\(?([^)]*)\)?$/i);
  if (foreign) {
    const fragment = foreign[1].trim().toLowerCase();
    const full = fragment.length >= 3 ? LANGUAGES.find((l) => l.startsWith(fragment)) : undefined;
    return full ? sentenceCase(full) : fragment ? sentenceCase(fragment) : "Lingua straniera";
  }
  return sentenceCase(s);
}

const looksLikeName = (line: string) =>
  line.length < 40 && line === line.toUpperCase() && !/\d/.test(line);

/**
 * Legge il testo della schermata "Compiti" di DidUP (copiato o condiviso):
 * "DA CONSEGNARE GIOVEDÌ 22 OTTOBRE", materia, docente, "Assegnato in 2° ora",
 * testo del compito, "ASSEGNATO IL 21 OTTOBRE". Se il formato non è riconosciuto,
 * ogni riga diventa un compito.
 */
export function parseDidup(text: string, now = Date.now()): ParsedTask[] {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const structured = lines.some((l) => HEADER.test(l) || ASSIGNED_ON.test(l) || ASSIGNED_IN.test(l));

  if (!structured) {
    return lines
      .filter((l) => l.length >= 3 && !NOISE.test(l))
      .map((title) => ({ title }));
  }

  const tasks: ParsedTask[] = [];
  let due: number | undefined;
  let state: "idle" | "subject" | "teacher" | "meta" | "body" = "subject";
  let subject = "";
  let body: string[] = [];

  const flush = () => {
    const title = body.join(" ").trim();
    if (title) tasks.push({ title, subject: subject ? prettySubject(subject) : undefined, dueDate: due });
    body = [];
  };

  for (const line of lines) {
    const header = line.match(HEADER);
    if (header) {
      flush();
      due = parseDue(header[1], header[2], now);
      state = "subject";
      continue;
    }
    if (state === "subject") {
      if (NOISE.test(line)) continue;
      subject = line;
      state = "teacher";
    } else if (state === "teacher") {
      if (ASSIGNED_IN.test(line)) state = "body";
      else if (looksLikeName(line)) state = "meta";
      else { body.push(line); state = "body"; }
    } else if (state === "meta") {
      if (ASSIGNED_IN.test(line)) state = "body";
      else { body.push(line); state = "body"; }
    } else if (state === "body") {
      if (ASSIGNED_ON.test(line)) { flush(); state = "subject"; }
      else body.push(line);
    }
  }
  flush();
  return tasks;
}
