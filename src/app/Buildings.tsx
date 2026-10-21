"use client";

import type { MedalIcon, Tier } from "@/lib/goals";

// Ogni traguardo è un edificio diverso, disegnato in stile flat isometrico.
// Lo stesso disegno serve per la città, per gli elenchi e per le schede.

export const TW = 26, TH = 13;
export const S = 1.8; // lato dell'impronta di un edificio, in tessere

export const P = (x: number, y: number, z = 0): [number, number] => [(x - y) * TW, (x + y) * TH - z];
const pts = (a: [number, number][]) => a.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

export const BUILDING_NAME: Record<MedalIcon, string> = {
  hourglass: "Fabbrica", clock: "Torre dell'orologio", calendar: "Municipio", week: "Condominio a terrazze", link: "Faro",
  shield: "Castello", undo: "Stazione", mountain: "Stadio", target: "Banca", list: "Biblioteca", rocket: "Osservatorio",
  moon: "Hotel", layers: "Grattacielo"
};

function rgb(hex: string) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(hex: string, to: string, f: number) {
  const a = rgb(hex), b = rgb(to);
  return "#" + a.map((v, i) => Math.round(v * (1 - f) + b[i] * f).toString(16).padStart(2, "0")).join("");
}
function tone(hex: string, k: number) {
  return "#" + rgb(hex).map((v) => Math.min(255, Math.round(v * k)).toString(16).padStart(2, "0")).join("");
}

type Part = {
  nx: number; ny: number; nw: number; nd: number; z0: number; h: number; c: string;
  roof?: "pitch" | "garden" | "tank" | "dome" | "pit"; rc?: string; windows?: boolean; cool?: boolean;
};

const KIND_COLOR: Record<MedalIcon, string> = {
  hourglass: "#e5584f", clock: "#f4c43a", calendar: "#f28a3b", week: "#3fc491", link: "#f4f1ea", shield: "#9aa6b4", undo: "#3f8fd6",
  mountain: "#d9dfe4", target: "#ece4d0", list: "#a77ad8", rocket: "#3f5f9e", moon: "#5b6fd6", layers: "#3fb0c4"
};

/** Pezzi che compongono ogni edificio. `u` = altezza di riferimento (cresce col livello). */
function parts(kind: MedalIcon, u: number): Part[] {
  const c = KIND_COLOR[kind];
  switch (kind) {
    case "hourglass": return [
      { nx: 0, ny: 0.3, nw: 1, nd: 0.7, z0: 0, h: u * 0.6, c, roof: "pitch", rc: "#8f3a32" },
      { nx: 0.08, ny: 0.04, nw: 0.22, nd: 0.22, z0: 0, h: u * 1.15, c: "#9a5a47", windows: false }
    ];
    case "clock": return [
      { nx: 0.22, ny: 0.22, nw: 0.56, nd: 0.56, z0: 0, h: u * 1.35, c, roof: "pitch", rc: "#c9531f" }
    ];
    case "calendar": return [
      { nx: 0, ny: 0.15, nw: 1, nd: 0.7, z0: 0, h: u * 0.6, c, roof: "pitch", rc: "#b8451c" },
      { nx: 0.38, ny: 0.38, nw: 0.24, nd: 0.24, z0: u * 0.6, h: u * 0.45, c: "#f6b27a", roof: "pitch", rc: "#b8451c" }
    ];
    case "week": return [
      { nx: 0, ny: 0, nw: 1, nd: 1, z0: 0, h: u * 0.42, c },
      { nx: 0.12, ny: 0.12, nw: 0.76, nd: 0.76, z0: u * 0.42, h: u * 0.36, c: mix(c, "#ffffff", 0.18) },
      { nx: 0.26, ny: 0.26, nw: 0.48, nd: 0.48, z0: u * 0.78, h: u * 0.36, c: mix(c, "#ffffff", 0.34), roof: "garden" }
    ];
    case "link": return [
      { nx: 0.18, ny: 0.18, nw: 0.64, nd: 0.64, z0: 0, h: u * 0.22, c: "#8b97a6", windows: false },
      { nx: 0.3, ny: 0.3, nw: 0.4, nd: 0.4, z0: u * 0.22, h: u * 0.32, c, cool: true, windows: false },
      { nx: 0.3, ny: 0.3, nw: 0.4, nd: 0.4, z0: u * 0.54, h: u * 0.26, c: "#e5584f", windows: false },
      { nx: 0.3, ny: 0.3, nw: 0.4, nd: 0.4, z0: u * 0.8, h: u * 0.26, c, windows: false },
      { nx: 0.36, ny: 0.36, nw: 0.28, nd: 0.28, z0: u * 1.06, h: u * 0.2, c: "#ffd76a", roof: "pitch", rc: "#e5584f", windows: false }
    ];
    case "shield": return [
      { nx: 0.22, ny: 0.22, nw: 0.56, nd: 0.56, z0: 0, h: u * 0.8, c },
      { nx: 0, ny: 0, nw: 0.3, nd: 0.3, z0: 0, h: u * 1.05, c: tone(c, 0.9), roof: "pitch", rc: "#3f6fb0" },
      { nx: 0.7, ny: 0, nw: 0.3, nd: 0.3, z0: 0, h: u * 1.05, c: tone(c, 0.9), roof: "pitch", rc: "#3f6fb0" },
      { nx: 0, ny: 0.7, nw: 0.3, nd: 0.3, z0: 0, h: u * 1.05, c: tone(c, 0.9), roof: "pitch", rc: "#3f6fb0" },
      { nx: 0.7, ny: 0.7, nw: 0.3, nd: 0.3, z0: 0, h: u * 1.05, c: tone(c, 0.9), roof: "pitch", rc: "#3f6fb0" }
    ];
    case "undo": return [
      { nx: 0, ny: 0.1, nw: 1, nd: 0.55, z0: 0, h: u * 0.55, c, roof: "pitch", rc: "#26558c" },
      { nx: 0, ny: 0.7, nw: 1, nd: 0.3, z0: 0, h: u * 0.3, c: "#e8edf2", windows: false }
    ];
    case "mountain": return [
      { nx: 0, ny: 0, nw: 1, nd: 1, z0: 0, h: u * 0.38, c, roof: "pit" },
      { nx: 0.02, ny: 0.02, nw: 0.08, nd: 0.08, z0: 0, h: u * 1.0, c: "#8b97a6", windows: false },
      { nx: 0.9, ny: 0.9, nw: 0.08, nd: 0.08, z0: 0, h: u * 1.0, c: "#8b97a6", windows: false }
    ];
    case "target": return [
      { nx: 0.04, ny: 0.2, nw: 0.92, nd: 0.6, z0: 0, h: u * 0.6, c, roof: "pitch", rc: "#cdbd98" },
      { nx: 0, ny: 0.8, nw: 1, nd: 0.2, z0: 0, h: 3, c: "#d9d2c0", windows: false }
    ];
    case "list": return [
      { nx: 0.06, ny: 0.1, nw: 0.88, nd: 0.8, z0: 0, h: u * 0.62, c },
      { nx: 0.06, ny: 0.1, nw: 0.88, nd: 0.8, z0: u * 0.62, h: u * 0.1, c: "#7d55b0", windows: false }
    ];
    case "rocket": return [
      { nx: 0.15, ny: 0.15, nw: 0.7, nd: 0.7, z0: 0, h: u * 0.7, c, roof: "dome" }
    ];
    case "moon": return [
      { nx: 0.1, ny: 0.1, nw: 0.8, nd: 0.8, z0: 0, h: u * 1.05, c, roof: "pitch", rc: "#34408f" }
    ];
    case "layers": return [
      { nx: 0.1, ny: 0.1, nw: 0.8, nd: 0.8, z0: 0, h: u * 0.5, c },
      { nx: 0.18, ny: 0.1, nw: 0.74, nd: 0.8, z0: u * 0.5, h: u * 0.42, c: "#2a8a9c" },
      { nx: 0.1, ny: 0.16, nw: 0.8, nd: 0.74, z0: u * 0.92, h: u * 0.42, c: "#5fc7d8" },
      { nx: 0.2, ny: 0.2, nw: 0.6, nd: 0.6, z0: u * 1.34, h: u * 0.34, c: "#2a8a9c" }
    ];
  }
}

type Opts = { x: number; y: number; kind: MedalIcon; tier: number; lit: boolean; night?: boolean; scaf?: boolean };

function Box({ part, x, y, lit, night }: { part: Part; x: number; y: number; lit: boolean; night: boolean }) {
  const { z0, h, roof } = part;
  const bx = x + part.nx * S, by = y + part.ny * S, w = part.nw * S, d = part.nd * S;
  const base = night ? mix(part.c, "#0f1d30", lit ? 0.55 : 0.78) : lit ? part.c : mix(part.c, "#9aa5ad", 0.45);
  const L = tone(base, 0.74), R = tone(base, 0.92), T = tone(base, 1.1);
  const edge = night && lit ? { stroke: "rgba(110,255,220,.65)", strokeWidth: 0.9 } : {};
  const winOn = night ? "#ffd76a" : "#fff4c2", winOff = night ? "#17283c" : "#718090", winCool = night ? "#ffd76a" : "#bfe3ff";
  const Pz = (px: number, py: number, pz: number) => P(px, py, pz + z0);
  const out: React.ReactNode[] = [];
  out.push(<polygon key="l" points={pts([Pz(bx, by + d, 0), Pz(bx + w, by + d, 0), Pz(bx + w, by + d, h), Pz(bx, by + d, h)])} fill={L} {...edge}/>);
  out.push(<polygon key="r" points={pts([Pz(bx + w, by, 0), Pz(bx + w, by + d, 0), Pz(bx + w, by + d, h), Pz(bx + w, by, h)])} fill={R} {...edge}/>);
  const showWin = part.windows !== false && h > 8;
  if (showWin) {
    const floors = Math.max(1, Math.round(h / 13));
    const c1 = Math.max(1, Math.round(w * 1.6)), c2 = Math.max(1, Math.round(d * 1.6));
    for (let r = 0; r < floors; r++) {
      for (let k = 0; k < c1; k++) {
        const u0 = ((k + 0.22) / c1) * w, u1 = ((k + 0.78) / c1) * w, a = ((r + 0.28) / floors) * (h - 5) + 3, b = ((r + 0.72) / floors) * (h - 5) + 3;
        out.push(<polygon key={`a${r}-${k}`} points={pts([Pz(bx + u0, by + d, a), Pz(bx + u1, by + d, a), Pz(bx + u1, by + d, b), Pz(bx + u0, by + d, b)])} fill={lit ? ((r * 7 + k * 3) % 5 === 0 ? winCool : winOn) : winOff}/>);
      }
      for (let k = 0; k < c2; k++) {
        const u0 = ((k + 0.22) / c2) * d, u1 = ((k + 0.78) / c2) * d, a = ((r + 0.28) / floors) * (h - 5) + 3, b = ((r + 0.72) / floors) * (h - 5) + 3;
        out.push(<polygon key={`b${r}-${k}`} points={pts([Pz(bx + w, by + u0, a), Pz(bx + w, by + u1, a), Pz(bx + w, by + u1, b), Pz(bx + w, by + u0, b)])} fill={lit ? ((r * 5 + k * 2) % 4 === 0 ? winCool : winOn) : winOff}/>);
      }
    }
  }
  out.push(<polygon key="t" points={pts([Pz(bx, by, h), Pz(bx + w, by, h), Pz(bx + w, by + d, h), Pz(bx, by + d, h)])} fill={T} {...edge}/>);
  const rcRaw = part.rc ?? "#888888";
  const rc = night ? mix(rcRaw, "#0f1d30", lit ? 0.45 : 0.75) : lit ? rcRaw : mix(rcRaw, "#9aa5ad", 0.4);
  if (roof === "pitch") {
    const rh = Math.min(15, 6 + w * 3.2);
    out.push(<polygon key="p1" points={pts([Pz(bx, by + d, h), Pz(bx + w, by + d, h), Pz(bx + w, by + d / 2, h + rh), Pz(bx, by + d / 2, h + rh)])} fill={tone(rc, 0.84)}/>);
    out.push(<polygon key="p2" points={pts([Pz(bx + w, by, h), Pz(bx + w, by + d, h), Pz(bx + w, by + d / 2, h + rh)])} fill={tone(rc, 0.96)}/>);
    out.push(<polygon key="p3" points={pts([Pz(bx, by, h), Pz(bx + w, by, h), Pz(bx + w, by + d / 2, h + rh), Pz(bx, by + d / 2, h + rh)])} fill={tone(rc, 1.12)}/>);
  } else if (roof === "garden") {
    const a = Pz(bx + w / 2, by + d / 2, h);
    out.push(<polygon key="g" points={pts([Pz(bx + w * 0.12, by + d * 0.12, h + 0.5), Pz(bx + w * 0.88, by + d * 0.12, h + 0.5), Pz(bx + w * 0.88, by + d * 0.88, h + 0.5), Pz(bx + w * 0.12, by + d * 0.88, h + 0.5)])} fill={night ? "#1d5a47" : "#5fd09a"}/>);
    out.push(<circle key="gt" cx={a[0]} cy={a[1] - 6} r={6} fill={night ? "#2a8a63" : "#2fa56f"}/>);
  } else if (roof === "dome") {
    const a = Pz(bx + w / 2, by + d / 2, h);
    out.push(<ellipse key="dm" cx={a[0]} cy={a[1] - 5} rx={w * TW * 0.62} ry={w * TH * 0.9 + 6} fill={night ? "#cfd8e6" : "#f4f1ea"} opacity={lit ? 1 : 0.8}/>);
    out.push(<rect key="sl" x={a[0] - 2} y={a[1] - 17} width={4} height={14} rx={2} fill={night ? "#ffd76a" : "#3f5f9e"}/>);
  } else if (roof === "pit") {
    out.push(<polygon key="pit" points={pts([Pz(bx + w * 0.13, by + d * 0.13, h + 0.4), Pz(bx + w * 0.87, by + d * 0.13, h + 0.4), Pz(bx + w * 0.87, by + d * 0.87, h + 0.4), Pz(bx + w * 0.13, by + d * 0.87, h + 0.4)])} fill={night ? "#1d6b4d" : "#58bf7a"}/>);
    const a = Pz(bx + w / 2, by + d / 2, h);
    out.push(<ellipse key="pc" cx={a[0]} cy={a[1]} rx={w * TW * 0.3} ry={w * TH * 0.3} fill="none" stroke="rgba(255,255,255,.8)" strokeWidth={1.2}/>);
  }
  return <>{out}</>;
}

/** Edificio completo. `tier` 1–5 ne determina l'altezza e le rifiniture. */
export function BuildingShape({ x, y, kind, tier, lit, night = false, scaf = false }: Opts) {
  const t = Math.max(1, tier);
  const u = 20 + t * 11;
  const ps = parts(kind, u);
  const top = Math.max(...ps.map((p) => p.z0 + p.h + (p.roof === "pitch" ? 12 : p.roof === "dome" ? 14 : 0)));
  const main = ps.reduce((a, b) => (b.z0 + b.h > a.z0 + a.h ? b : a));
  const cx = x + (main.nx + main.nw / 2) * S, cy = y + (main.ny + main.nd / 2) * S;
  const roofBoost = main.roof === "pitch" ? 12 : main.roof === "dome" ? 12 : 0;
  const tp = P(cx, cy, main.z0 + main.h + roofBoost);
  // ordine di disegno: dai pezzi più lontani a quelli più vicini
  const sorted = ps.map((p, i) => ({ p, i })).sort((a, b) => (a.p.nx + a.p.nw + a.p.ny + a.p.nd + a.p.z0 * 0.001) - (b.p.nx + b.p.nw + b.p.ny + b.p.nd + b.p.z0 * 0.001));
  const gold = t >= 5;
  const body = sorted.map(({ p, i }) => <Box key={i} part={p} x={x} y={y} lit={lit} night={night}/>);
  const extras: React.ReactNode[] = [];
  if (kind === "clock") {
    const f = P(x + (main.nx + main.nw) * S, y + (main.ny + main.nd / 2) * S, u * 1.05);
    extras.push(<g key="ck" transform={`translate(${f[0]},${f[1]})`}><ellipse rx={5.5} ry={6.5} fill="#fff" stroke="#6b4a10" strokeWidth={1}/><path d="M0 0V-4M0 0L3 1" stroke="#6b4a10" strokeWidth={1} strokeLinecap="round"/></g>);
  }
  if (kind === "target") {
    for (let k = 0; k < 5; k++) {
      const a = P(x + (0.04 + 0.92 * (k / 4)) * S, y + 0.8 * S, 3), b = P(x + (0.04 + 0.92 * (k / 4)) * S, y + 0.8 * S, u * 0.55);
      extras.push(<line key={`col${k}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={night ? "#9fb3c4" : "#fffdf5"} strokeWidth={2.4}/>);
    }
  }
  if (kind === "mountain") {
    for (const [fx, fy] of [[0.02, 0.02], [0.9, 0.9]]) {
      const a = P(x + (fx + 0.04) * S, y + (fy + 0.04) * S, u * 1.0);
      extras.push(<rect key={`lamp${fx}`} x={a[0] - 5} y={a[1] - 5} width={10} height={5} rx={1.5} fill={night ? "#ffe9a0" : "#fff4c2"}/>);
    }
  }
  if (kind === "moon") {
    const a = P(x + 0.5 * S, y + 0.5 * S, u * 1.05 + 16);
    extras.push(<g key="mn"><circle cx={a[0]} cy={a[1] - 4} r={6} fill="#ffd76a"/><circle cx={a[0] + 3} cy={a[1] - 6} r={5.2} fill={night ? "#0f1d30" : "#8fa2e6"}/></g>);
  }
  if (kind === "link") {
    const a = P(x + 0.5 * S, y + 0.5 * S, u * 1.26 + 10);
    extras.push(<g key="lt">{lit && <circle cx={a[0]} cy={a[1]} r={9} fill="rgba(255,215,106,.35)"/>}</g>);
  }
  if (kind === "rocket") {
    const a = P(x + 0.5 * S, y + 0.5 * S, top + 2);
    extras.push(<line key="tl" x1={a[0] + 5} y1={a[1] - 4} x2={a[0] + 15} y2={a[1] - 14} stroke={night ? "#9fb3c4" : "#c9d3de"} strokeWidth={2.4} strokeLinecap="round"/>);
  }
  // rifiniture di livello: bandiera dal livello 3, guglia/oro dal 5
  const finish: React.ReactNode[] = [];
  if (t >= 3 && kind !== "rocket") {
    const fy = tp[1] - (kind === "link" ? 6 : 0);
    finish.push(<line key="fp" x1={tp[0]} y1={fy} x2={tp[0]} y2={fy - 18} stroke={night ? "#9fb3c4" : "#5b6b78"} strokeWidth={1.4}/>);
    finish.push(<polygon key="fl" points={`${tp[0]},${fy - 18} ${tp[0] + 11},${fy - 14} ${tp[0]},${fy - 10}`} fill={gold ? "#ffc857" : "#e5584f"}/>);
  }
  if (gold) finish.push(<circle key="gd" cx={tp[0]} cy={tp[1] - 20} r={3.2} fill="#ffc857"/>);
  const sc: React.ReactNode[] = [];
  if (scaf) {
    const m = main, mw = m.nw * S, md = m.nd * S, bx = x + m.nx * S, by = y + m.ny * S;
    for (let k = 0; k <= 3; k++) { const a = P(bx + mw, by + (md * k) / 3, m.z0), b = P(bx + mw, by + (md * k) / 3, m.z0 + m.h); sc.push(<line key={`sv${k}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#f0a43a" strokeWidth={1.6}/>); }
    for (let r = 1; r <= 3; r++) { const a = P(bx + mw, by, m.z0 + (m.h * r) / 4), b = P(bx + mw, by + md, m.z0 + (m.h * r) / 4); sc.push(<line key={`sh${r}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#f0a43a" strokeWidth={1.4}/>); }
    const a = P(bx + mw / 2, by + md / 2, m.z0 + m.h);
    sc.push(<polygon key="cone" points={`${a[0] - 5},${a[1] - 1} ${a[0] + 5},${a[1] - 1} ${a[0]},${a[1] - 12}`} fill="#f0a43a"/>);
  }
  const style = night && lit ? { filter: "drop-shadow(0 0 5px rgba(255,215,110,.5))" } : undefined;
  return <g style={style}>{body}{extras}{finish}{sc}</g>;
}

/** Altezza massima raggiunta (in px) da un edificio: serve a inquadrarlo nelle icone. */
function heightOf(kind: MedalIcon, tier: number) {
  const u = 20 + Math.max(1, tier) * 11;
  return Math.max(...parts(kind, u).map((p) => p.z0 + p.h + (p.roof === "pitch" ? 12 : p.roof === "dome" ? 14 : 0))) + (tier >= 3 ? 30 : 12);
}

/**
 * Icona di un edificio per elenchi e schede. `tier` 0 = ancora da costruire (sagoma grigia),
 * `lit` false = da riaccendere (cantiere), `record` = miglior livello raggiunto in passato.
 */
export default function BuildingIcon({ icon, tier, size = 64, lit = true, record, pop = false }: { icon: MedalIcon; tier: Tier; size?: number; lit?: boolean; record?: Tier; pop?: boolean }) {
  const locked = tier === 0 && !(record && record > 0);
  const shown = locked ? 1 : Math.max(tier, record ?? 0, 1);
  const top = heightOf(icon, shown);
  const bottom = P(S, S)[1] + 4;
  const h = top + bottom, w = S * TW * 2 + 14;
  const side = Math.max(h, w);
  const vx = -side / 2, vy = bottom - side;
  return (
    <span className={`bld${locked ? " locked" : ""}${pop ? " pop" : ""}`} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox={`${vx.toFixed(1)} ${vy.toFixed(1)} ${side.toFixed(1)} ${side.toFixed(1)}`} width={size} height={size}>
        <polygon points={pts([P(0, 0), P(S, 0), P(S, S), P(0, S)])} fill="rgba(120,150,130,.22)"/>
        <BuildingShape x={0} y={0} kind={icon} tier={shown} lit={locked ? false : lit} scaf={!locked && !lit}/>
      </svg>
      {record !== undefined && record > tier && tier > 0 && <span className="bld-record" title="Il tuo record"/>}
    </span>
  );
}

/** Casetta: una per ogni sfida settimanale completata. */
export function House({ x, y, col, h, night = false }: { x: number; y: number; col: string; h: number; night?: boolean }) {
  return <Box part={{ nx: 0.1, ny: 0.1, nw: 0.4, nd: 0.4, z0: 0, h, c: col, roof: "pitch", rc: "#b5472f", windows: true }} x={x} y={y} lit night={night}/>;
}
