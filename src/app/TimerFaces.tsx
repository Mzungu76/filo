"use client";

// 69 timer diversi: 23 forme × 3 tavolozze. Ogni nuovo blocco di studio ne usa uno diverso.
// `value` va da 1 (pieno) a 0 (finito).

export type Palette = { bg: [string, string]; fg: [string, string]; track: string; ink: string; on: string };

export const PALETTES: Palette[] = [
  { bg: ["#1b5a6e", "#0b1f2c"], fg: ["#e6fbf1", "#6fd3ac"], track: "rgba(255,255,255,.13)", ink: "#ffffff", on: "#0d2a39" },
  { bg: ["#7a2e5a", "#2b1238"], fg: ["#ffd6a0", "#ff7a59"], track: "rgba(255,255,255,.14)", ink: "#ffffff", on: "#3a1230" },
  { bg: ["#0b3d91", "#041a45"], fg: ["#bde7ff", "#38b6ff"], track: "rgba(255,255,255,.14)", ink: "#ffffff", on: "#05224f" },
  { bg: ["#1f5a2b", "#0a2412"], fg: ["#eaffb8", "#8fe04a"], track: "rgba(255,255,255,.13)", ink: "#ffffff", on: "#0f3a1a" },
  { bg: ["#4a2a8c", "#1a0f3f"], fg: ["#f0d9ff", "#b57bff"], track: "rgba(255,255,255,.14)", ink: "#ffffff", on: "#2a1560" },
  { bg: ["#8c2f39", "#33101a"], fg: ["#ffe3df", "#ff8a80"], track: "rgba(255,255,255,.14)", ink: "#ffffff", on: "#4a1019" },
  { bg: ["#3a3a3a", "#111111"], fg: ["#fff1b8", "#f2b632"], track: "rgba(255,255,255,.12)", ink: "#ffffff", on: "#2a1f00" },
  { bg: ["#0f5c5c", "#06282b"], fg: ["#fff3d6", "#35d0c0"], track: "rgba(255,255,255,.14)", ink: "#ffffff", on: "#063a3a" },
  { bg: ["#8a2d6b", "#2d0f27"], fg: ["#ffe0f1", "#ff6fb5"], track: "rgba(255,255,255,.14)", ink: "#ffffff", on: "#4a1038" },
  { bg: ["#0a1230", "#02050f"], fg: ["#aef6ff", "#00e5ff"], track: "rgba(255,255,255,.1)", ink: "#ffffff", on: "#021a33" },
  { bg: ["#7a4a0e", "#2a1704"], fg: ["#ffe9a8", "#ffa726"], track: "rgba(255,255,255,.14)", ink: "#ffffff", on: "#3a2000" },
  { bg: ["#2d3a4d", "#10171f"], fg: ["#f2f7ff", "#9bb8ff"], track: "rgba(255,255,255,.13)", ink: "#ffffff", on: "#1a2540" },
  { bg: ["#fff4e0", "#ffd9a8"], fg: ["#d9480f", "#7a2e00"], track: "rgba(122,46,0,.14)", ink: "#4a1d00", on: "#ffffff" },
  { bg: ["#e3f4ff", "#b9dcff"], fg: ["#1c7ed6", "#0b3d91"], track: "rgba(11,61,145,.14)", ink: "#0a2a63", on: "#ffffff" },
  { bg: ["#e6fff3", "#b7f0d4"], fg: ["#12a05c", "#0b5a3a"], track: "rgba(11,90,58,.14)", ink: "#073d27", on: "#ffffff" },
  { bg: ["#f3ebff", "#d9c6ff"], fg: ["#7048e8", "#3d1d8c"], track: "rgba(61,29,140,.14)", ink: "#2a1262", on: "#ffffff" }
];

type Shape =
  | "circle" | "ticks" | "thin" | "square" | "hexagon" | "triangle" | "diamond" | "pentagon" | "octagon" | "star" | "heart" | "spiral" | "arc"
  | "dots" | "dashes" | "pie" | "battery" | "liquid" | "hourglass" | "grid" | "concentric" | "petals" | "rays";

const SHAPES: Shape[] = [
  "circle", "ticks", "thin", "square", "hexagon", "triangle", "diamond", "pentagon", "octagon", "star", "heart", "spiral", "arc",
  "dots", "dashes", "pie", "battery", "liquid", "hourglass", "grid", "concentric", "petals", "rays"
];

export const STYLE_COUNT = SHAPES.length * 3;

/** Forma e colori del timer numero `i` (0 … STYLE_COUNT-1). */
export function styleAt(i: number): { shape: Shape; pal: Palette } {
  const k = ((i % STYLE_COUNT) + STYLE_COUNT) % STYLE_COUNT;
  return { shape: SHAPES[k % SHAPES.length], pal: PALETTES[(k * 5 + Math.floor(k / SHAPES.length) * 3) % PALETTES.length] };
}

/** Variabili CSS (sfondo, pulsanti) per lo stile scelto. */
export function styleVars(i: number): React.CSSProperties {
  const { pal } = styleAt(i);
  return {
    "--solo-bg": `radial-gradient(120% 70% at 50% 30%, ${pal.bg[0]} 0%, ${pal.bg[1]} 100%)`,
    "--solo-f1": pal.fg[0], "--solo-f2": pal.fg[1], "--solo-ink": pal.ink, "--solo-on": pal.on, "--solo-track": pal.track
  } as React.CSSProperties;
}

const C = 150;
const poly = (n: number, r: number, rot = -90, alt?: number) => {
  const pts: string[] = [];
  const m = alt ? n * 2 : n;
  for (let k = 0; k < m; k++) {
    const rr = alt && k % 2 ? alt : r;
    const a = ((rot + (360 / m) * k) * Math.PI) / 180;
    pts.push(`${(C + rr * Math.cos(a)).toFixed(1)},${(C + rr * Math.sin(a)).toFixed(1)}`);
  }
  return "M" + pts.join(" L") + " Z";
};
const SQUARE = "M150 40 H220 A40 40 0 0 1 260 80 V220 A40 40 0 0 1 220 260 H80 A40 40 0 0 1 40 220 V80 A40 40 0 0 1 80 40 Z";
const CIRCLE = "M150 30 a120 120 0 1 1 0 240 a120 120 0 1 1 0 -240";
const HEART = "M150 250 C40 170 30 90 90 65 C120 52 145 70 150 95 C155 70 180 52 210 65 C270 90 260 170 150 250 Z";
const ARC = "M30 200 A120 120 0 0 1 270 200";
const SPIRAL = (() => {
  const pts: string[] = [];
  for (let t = 0; t <= 1; t += 0.01) {
    const a = -Math.PI / 2 + t * Math.PI * 6;
    const r = 125 - t * 100;
    pts.push(`${(C + r * Math.cos(a)).toFixed(1)},${(C + r * Math.sin(a)).toFixed(1)}`);
  }
  return "M" + pts.join(" L");
})();
const PATHS: Partial<Record<Shape, string>> = {
  circle: CIRCLE, ticks: "M150 38 a112 112 0 1 1 0 224 a112 112 0 1 1 0 -224", thin: CIRCLE, square: SQUARE, hexagon: poly(6, 125), triangle: poly(3, 140),
  diamond: poly(4, 130), pentagon: poly(5, 128), octagon: poly(8, 125), star: poly(5, 135, -90, 58), heart: HEART, spiral: SPIRAL, arc: ARC
};

export default function TimerFace({ index, value, children }: { index: number; value: number; children?: React.ReactNode }) {
  const { shape, pal } = styleAt(index);
  const v = Math.min(1, Math.max(0, value));
  const [f1, f2] = pal.fg;
  const gid = `tf${index}`;
  const defs = (
    <defs>
      <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={f1}/><stop offset="1" stopColor={f2}/></linearGradient>
      <filter id={`${gid}g`}><feGaussianBlur stdDeviation="6"/></filter>
    </defs>
  );
  const fill = `url(#${gid})`;
  const track = pal.track;
  const body: React.ReactNode[] = [];
  const outline = PATHS[shape];

  if (outline) {
    const w = shape === "thin" ? 4 : shape === "spiral" ? 9 : shape === "arc" ? 16 : 13;
    const lj = { strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
    body.push(<path key="t" d={outline} fill="none" stroke={track} strokeWidth={w} {...lj}/>);
    if (v > 0.002) {
      body.push(<path key="gl" d={outline} pathLength={1} fill="none" stroke={f2} strokeWidth={w} opacity={0.4} filter={`url(#${gid}g)`} strokeDasharray="1 1" strokeDashoffset={1 - v} {...lj}/>);
      body.push(<path key="p" d={outline} pathLength={1} fill="none" stroke={fill} strokeWidth={w} strokeDasharray="1 1" strokeDashoffset={1 - v} {...lj}/>);
    }
    if (shape === "ticks") {
      for (let k = 0; k < 60; k++) {
        const a = (k / 60) * Math.PI * 2, major = k % 5 === 0, r1 = major ? 76 : 82, r2 = 90;
        body.push(<line key={`k${k}`} x1={C + r1 * Math.sin(a)} y1={C - r1 * Math.cos(a)} x2={C + r2 * Math.sin(a)} y2={C - r2 * Math.cos(a)} stroke={pal.ink} opacity={major ? 0.45 : 0.18} strokeWidth={major ? 2.4 : 1.4} strokeLinecap="round"/>);
      }
    }
  } else if (shape === "dots" || shape === "dashes" || shape === "rays") {
    const n = shape === "dashes" ? 48 : shape === "rays" ? 24 : 60;
    const lit = Math.ceil(v * n - 1e-6);
    if (shape === "rays") body.push(<circle key="sun" cx={C} cy={C} r={62} fill={track}/>);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, on = k < lit;
      const sx = Math.sin(a), sy = -Math.cos(a);
      if (shape === "dots") body.push(<circle key={k} cx={C + 118 * sx} cy={C + 118 * sy} r={5.5} fill={on ? fill : track}/>);
      else if (shape === "dashes") body.push(<line key={k} x1={C + 96 * sx} y1={C + 96 * sy} x2={C + 126 * sx} y2={C + 126 * sy} stroke={on ? fill : track} strokeWidth={6} strokeLinecap="round"/>);
      else body.push(<line key={k} x1={C + 84 * sx} y1={C + 84 * sy} x2={C + 128 * sx} y2={C + 128 * sy} stroke={on ? fill : track} strokeWidth={9} strokeLinecap="round"/>);
    }
  } else if (shape === "pie") {
    body.push(<circle key="t" cx={C} cy={C} r={118} fill={track}/>);
    if (v >= 0.999) body.push(<circle key="p" cx={C} cy={C} r={118} fill={fill}/>);
    else if (v > 0.002) {
      const a = v * Math.PI * 2, x = C + 118 * Math.sin(a), y = C - 118 * Math.cos(a);
      body.push(<path key="p" d={`M${C} ${C} L${C} ${C - 118} A118 118 0 ${v > 0.5 ? 1 : 0} 1 ${x.toFixed(1)} ${y.toFixed(1)} Z`} fill={fill}/>);
    }
  } else if (shape === "battery") {
    body.push(<rect key="cap" x={125} y={28} width={50} height={14} rx={5} fill={track}/>);
    body.push(<rect key="t" x={85} y={42} width={130} height={226} rx={26} fill={track}/>);
    const h = 206 * v;
    body.push(<clipPath key="cp" id={`${gid}c`}><rect x={95} y={52} width={110} height={206} rx={18}/></clipPath>);
    body.push(<rect key="f" x={95} y={52 + 206 - h} width={110} height={h} fill={fill} clipPath={`url(#${gid}c)`}/>);
  } else if (shape === "liquid") {
    body.push(<clipPath key="cp" id={`${gid}c`}><circle cx={C} cy={C} r={112}/></clipPath>);
    body.push(<circle key="t" cx={C} cy={C} r={118} fill={track}/>);
    const y = 262 - 224 * v;
    body.push(
      <g key="w" clipPath={`url(#${gid}c)`}>
        <g>
          <animateTransform attributeName="transform" type="translate" from="0 0" to="-120 0" dur="4s" repeatCount="indefinite"/>
          <path d={`M-120 ${y} q30 -10 60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 V300 H-120 Z`} fill={fill}/>
        </g>
      </g>
    );
    body.push(<circle key="o" cx={C} cy={C} r={118} fill="none" stroke={f2} strokeWidth={4} opacity={0.6}/>);
  } else if (shape === "hourglass") {
    const top = "M80 40 H220 L150 150 Z", bot = "M150 150 L220 260 H80 Z";
    body.push(<path key="tt" d={top} fill={track}/>, <path key="tb" d={bot} fill={track}/>);
    body.push(<clipPath key="c1" id={`${gid}a`}><path d={top}/></clipPath>, <clipPath key="c2" id={`${gid}b`}><path d={bot}/></clipPath>);
    body.push(<rect key="s1" x={70} y={150 - 110 * v} width={160} height={110 * v} fill={fill} clipPath={`url(#${gid}a)`}/>);
    body.push(<rect key="s2" x={70} y={260 - 110 * (1 - v)} width={160} height={110 * (1 - v)} fill={fill} clipPath={`url(#${gid}b)`} opacity={0.55}/>);
    if (v > 0.01 && v < 0.99) body.push(<line key="st" x1={150} y1={150} x2={150} y2={254} stroke={f2} strokeWidth={2.5} strokeDasharray="3 4"/>);
    body.push(<path key="ol" d={top + " " + bot} fill="none" stroke={pal.ink} strokeWidth={4} opacity={0.5} strokeLinejoin="round"/>);
  } else if (shape === "grid") {
    const lit = Math.ceil(v * 25 - 1e-6);
    for (let k = 0; k < 25; k++) {
      const cx = 38 + (k % 5) * 50, cy = 38 + Math.floor(k / 5) * 50;
      body.push(<rect key={k} x={cx} y={cy} width={42} height={42} rx={11} fill={k < lit ? fill : track}/>);
    }
  } else if (shape === "concentric") {
    const rings: [number, number, number][] = [[120, 12, v], [92, 12, Math.min(1, v * 1.5)], [64, 12, Math.min(1, v * 2.4)]];
    rings.forEach(([r, w, val], k) => {
      const d = `M150 ${150 - r} a${r} ${r} 0 1 1 0 ${2 * r} a${r} ${r} 0 1 1 0 ${-2 * r}`;
      body.push(<path key={`t${k}`} d={d} fill="none" stroke={track} strokeWidth={w}/>);
      if (val > 0.002) body.push(<path key={`p${k}`} d={d} pathLength={1} fill="none" stroke={fill} strokeWidth={w} strokeLinecap="round" strokeDasharray="1 1" strokeDashoffset={1 - val}/>);
    });
  } else if (shape === "petals") {
    const lit = Math.ceil(v * 12 - 1e-6);
    for (let k = 0; k < 12; k++) {
      body.push(<ellipse key={k} cx={C} cy={C - 78} rx={20} ry={50} fill={k < lit ? fill : track} opacity={k < lit ? 1 : 0.8} transform={`rotate(${k * 30} ${C} ${C})`}/>);
    }
  }

  // Forme piene: un disco morbido dietro i numeri, così restano leggibili.
  if (["pie", "battery", "liquid", "hourglass", "grid", "petals"].includes(shape)) {
    body.push(<circle key="plate" cx={C} cy={C} r={shape === "petals" ? 56 : 78} fill={pal.bg[1]} opacity={0.82}/>);
  }

  return (
    <div className="big-ring tface" style={{ color: pal.ink }}>
      <svg viewBox="0 0 300 300" aria-hidden="true">{defs}{body}</svg>
      {children}
    </div>
  );
}
