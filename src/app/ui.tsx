"use client";

const CIRC = 2 * Math.PI * 90;

/** Anello di avanzamento: filo continuo con estremità arrotondate e transizione morbida. */
export function Ring({ progress, className, children }: { progress: number; className: string; children?: React.ReactNode }) {
  const p = Math.min(1, Math.max(0, progress));
  return (
    <div className={className}>
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#e6fbf1"/>
            <stop offset="1" stopColor="#7fd8b3"/>
          </linearGradient>
        </defs>
        <circle className="track" cx="100" cy="100" r="90"/>
        <circle className="prog" cx="100" cy="100" r="90" strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - p)} style={{ opacity: p > 0.002 ? 1 : 0 }}/>
      </svg>
      {children}
    </div>
  );
}

/** Tonalità stabile per materia (colore di barra e etichetta). */
export function subjectHue(name?: string) {
  if (!name) return 205;
  let h = 7;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

/** Piccola vibrazione di conferma al tocco (dove supportata). */
export function tap(ms = 12) {
  try { navigator.vibrate?.(ms); } catch {}
}
