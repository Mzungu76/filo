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

const BIG_R = 128;
const BIG_C = 2 * Math.PI * BIG_R;
const TICKS = Array.from({ length: 60 }, (_, i) => {
  const a = (i / 60) * Math.PI * 2;
  const major = i % 5 === 0;
  const r1 = BIG_R - 22, r2 = BIG_R - (major ? 36 : 29);
  return { x1: 150 + Math.cos(a) * r1, y1: 150 + Math.sin(a) * r1, x2: 150 + Math.cos(a) * r2, y2: 150 + Math.sin(a) * r2, major };
});

/** Anello da orologio della home: tacche, alone luminoso e arco che si consuma con il tempo (1 = pieno, pronto). */
export function BigRing({ value, children }: { value: number; children?: React.ReactNode }) {
  const v = Math.min(1, Math.max(0, value));
  return (
    <div className="big-ring">
      <svg viewBox="0 0 300 300" aria-hidden="true">
        <defs>
          <linearGradient id="bigGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#e6fbf1"/>
            <stop offset="1" stopColor="#6fd3ac"/>
          </linearGradient>
          <filter id="bigGlow"><feGaussianBlur stdDeviation="7"/></filter>
        </defs>
        {TICKS.map((t, i) => <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={`rgba(255,255,255,${t.major ? 0.38 : 0.16})`} strokeWidth={t.major ? 2.6 : 1.5} strokeLinecap="round"/>)}
        <circle cx="150" cy="150" r={BIG_R} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="13"/>
        <g transform="rotate(-90 150 150)" style={{ opacity: v > 0.002 ? 1 : 0 }}>
          <circle cx="150" cy="150" r={BIG_R} fill="none" stroke="#6fd3ac" strokeWidth="13" opacity=".45" filter="url(#bigGlow)" strokeDasharray={BIG_C} strokeDashoffset={BIG_C * (1 - v)} className="big-prog"/>
          <circle cx="150" cy="150" r={BIG_R} fill="none" stroke="url(#bigGrad)" strokeWidth="13" strokeLinecap="round" strokeDasharray={BIG_C} strokeDashoffset={BIG_C * (1 - v)} className="big-prog"/>
        </g>
      </svg>
      {children}
    </div>
  );
}

/** Intestazione scura condivisa dalle pagine (stesso stile della home). */
export function PageHero({ top, eyebrow, title, sub, children }: { top: React.ReactNode; eyebrow: string; title?: string; sub?: string; children?: React.ReactNode }) {
  return (
    <header className="page-hero">
      {top}
      <p className="eyebrow">{eyebrow}</p>
      {title && <h1>{title}</h1>}
      {sub && <p className="subhead">{sub}</p>}
      {children}
    </header>
  );
}
