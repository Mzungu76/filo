"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Moon, Plus, Sun } from "lucide-react";
import type { MedalState } from "@/lib/goals";

// La città nasce da quello che fai: ogni medaglia è un edificio (cresce col livello migliore
// raggiunto), ogni sfida completata una casa, ogni livello un nuovo isolato.
// Stile "flat" isometrico; di sera passa al neon.

const TW = 26, TH = 13;
const COLS = 4;          // isolati per riga
const PITCH = 4;         // lato di un isolato (3 tessere) + strada (1)
type Fam = MedalState["def"]["family"];

const FAM: Record<Fam, string> = { Costanza: "#f28a3b", Efficacia: "#3f8fd6", Organizzazione: "#f4c43a", Equilibrio: "#3fc491", Impegno: "#e5584f" };
const ROOF: Record<Fam, string> = { Costanza: "#c9531f", Efficacia: "#1f5fa8", Organizzazione: "#d99a10", Equilibrio: "#1e8f66", Impegno: "#b02f2a" };
const HOUSE_COL = ["#f28a3b", "#3f8fd6", "#f4c43a", "#3fc491", "#e5584f", "#a77ad8"];

const P = (x: number, y: number, z = 0): [number, number] => [(x - y) * TW, (x + y) * TH - z];
const pts = (a: [number, number][]) => a.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

function mix(hex: string, to: string, f: number) {
  const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16);
  const c = (sh: number) => Math.round(((a >> sh) & 255) * (1 - f) + ((b >> sh) & 255) * f);
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}
function tone(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (sh: number) => Math.min(255, Math.round(((n >> sh) & 255) * k));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}
const hash = (a: number, b: number) => { let h = (a * 374761393 + b * 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return (h ^ (h >>> 16)) >>> 0; };

type Look = { night: boolean };
type BoxOpts = {
  x: number; y: number; w: number; d: number; h: number; c: string; rc?: string; roof?: "flat" | "pitch" | "tank" | "garden";
  lit: boolean; scaf?: boolean; spire?: boolean; flag?: boolean; floors?: number; gold?: boolean;
};

function Building({ o, look }: { o: BoxOpts; look: Look }) {
  const { x, y, w, d, h, c, roof = "flat", lit, scaf, spire, flag, gold } = o;
  const { night } = look;
  const floors = o.floors ?? Math.max(1, Math.round(h / 14));
  const base = night ? mix(c, "#0f1d30", lit ? 0.55 : 0.78) : lit ? c : mix(c, "#9aa5ad", 0.42);
  const toHex = (rgb: string) => "#" + (rgb.match(/\d+/g) ?? []).map((v) => (+v).toString(16).padStart(2, "0")).join("");
  const bh = base.startsWith("#") ? base : toHex(base);
  const L = tone(bh, 0.74), R = tone(bh, 0.92), T = tone(bh, 1.12);
  const edge = night && lit ? { stroke: "rgba(110,255,220,.65)", strokeWidth: 0.9 } : {};
  const winOn = night ? "#ffd76a" : "#fff4c2";
  const winOff = night ? "#17283c" : "#6f7f8b";
  const winCool = night ? "#ffd76a" : "#bfe3ff";
  const out: React.ReactNode[] = [];
  out.push(<polygon key="l" points={pts([P(x, y + d), P(x + w, y + d), P(x + w, y + d, h), P(x, y + d, h)])} fill={L} {...edge}/>);
  out.push(<polygon key="r" points={pts([P(x + w, y), P(x + w, y + d), P(x + w, y + d, h), P(x + w, y, h)])} fill={R} {...edge}/>);
  const cols = Math.max(1, Math.round(w * 1.6)), cols2 = Math.max(1, Math.round(d * 1.6));
  for (let r = 0; r < floors; r++) {
    for (let k = 0; k < cols; k++) {
      const u0 = ((k + 0.22) / cols) * w, u1 = ((k + 0.78) / cols) * w, z0 = ((r + 0.28) / floors) * (h - 5) + 3, z1 = ((r + 0.72) / floors) * (h - 5) + 3;
      out.push(<polygon key={`a${r}-${k}`} points={pts([P(x + u0, y + d, z0), P(x + u1, y + d, z0), P(x + u1, y + d, z1), P(x + u0, y + d, z1)])} fill={lit ? ((r * 7 + k * 3) % 5 === 0 ? winCool : winOn) : winOff}/>);
    }
    for (let k = 0; k < cols2; k++) {
      const u0 = ((k + 0.22) / cols2) * d, u1 = ((k + 0.78) / cols2) * d, z0 = ((r + 0.28) / floors) * (h - 5) + 3, z1 = ((r + 0.72) / floors) * (h - 5) + 3;
      out.push(<polygon key={`b${r}-${k}`} points={pts([P(x + w, y + u0, z0), P(x + w, y + u1, z0), P(x + w, y + u1, z1), P(x + w, y + u0, z1)])} fill={lit ? ((r * 5 + k * 2) % 4 === 0 ? winCool : winOn) : winOff}/>);
    }
  }
  out.push(<polygon key="t" points={pts([P(x, y, h), P(x + w, y, h), P(x + w, y + d, h), P(x, y + d, h)])} fill={T} {...edge}/>);
  const rc = o.rc ? (night ? mix(o.rc, "#0f1d30", lit ? 0.45 : 0.75) : lit ? o.rc : mix(o.rc, "#9aa5ad", 0.4)) : "#888";
  const rch = rc.startsWith("#") ? rc : toHex(rc);
  if (roof === "pitch") {
    const rh = Math.min(14, 6 + w * 3);
    out.push(<polygon key="p1" points={pts([P(x, y + d, h), P(x + w, y + d, h), P(x + w, y + d / 2, h + rh), P(x, y + d / 2, h + rh)])} fill={tone(rch, 0.84)}/>);
    out.push(<polygon key="p2" points={pts([P(x + w, y, h), P(x + w, y + d, h), P(x + w, y + d / 2, h + rh)])} fill={tone(rch, 0.96)}/>);
    out.push(<polygon key="p3" points={pts([P(x, y, h), P(x + w, y, h), P(x + w, y + d / 2, h + rh), P(x, y + d / 2, h + rh)])} fill={tone(rch, 1.12)}/>);
  } else if (roof === "tank") {
    const a = P(x + w * 0.3, y + d * 0.3, h);
    out.push(<rect key="tk" x={a[0] - 5} y={a[1] - 11} width={10} height={11} rx={2} fill={night ? "#2a4058" : "#8fa3b0"}/>);
  } else if (roof === "garden") {
    const a = P(x + w * 0.5, y + d * 0.5, h);
    out.push(<polygon key="g" points={pts([P(x + w * 0.15, y + d * 0.15, h + 0.5), P(x + w * 0.85, y + d * 0.15, h + 0.5), P(x + w * 0.85, y + d * 0.85, h + 0.5), P(x + w * 0.15, y + d * 0.85, h + 0.5)])} fill={night ? "#1d5a47" : "#5fd09a"}/>);
    out.push(<circle key="gt" cx={a[0]} cy={a[1] - 7} r={6} fill={night ? "#2a8a63" : "#2fa56f"}/>);
  }
  if (spire) {
    const a = P(x + w / 2, y + d / 2, h);
    out.push(<polygon key="sp" points={`${a[0] - 3},${a[1]} ${a[0] + 3},${a[1]} ${a[0]},${a[1] - 26}`} fill={gold ? "#ffc857" : "#dfe8ee"}/>);
  }
  if (flag) {
    const a = P(x + w / 2, y + d / 2, h + (roof === "pitch" ? 10 : 0));
    out.push(<line key="fp" x1={a[0]} y1={a[1]} x2={a[0]} y2={a[1] - 20} stroke={night ? "#9fb3c4" : "#5b6b78"} strokeWidth={1.4}/>);
    out.push(<polygon key="fl" points={`${a[0]},${a[1] - 20} ${a[0] + 11},${a[1] - 16} ${a[0]},${a[1] - 12}`} fill={gold ? "#ffc857" : "#e5584f"}/>);
  }
  if (gold && !spire && !flag) {
    const a = P(x + w / 2, y + d / 2, h);
    out.push(<circle key="gd" cx={a[0]} cy={a[1] - 3} r={3.5} fill="#ffc857"/>);
  }
  if (scaf) {
    for (let k = 0; k <= 3; k++) { const a = P(x + w, y + (d * k) / 3), b = P(x + w, y + (d * k) / 3, h); out.push(<line key={`sv${k}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#f0a43a" strokeWidth={1.6}/>); }
    for (let r = 1; r <= 3; r++) { const a = P(x + w, y, (h * r) / 4), b = P(x + w, y + d, (h * r) / 4); out.push(<line key={`sh${r}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#f0a43a" strokeWidth={1.4}/>); }
    const a = P(x + w / 2, y + d / 2, h);
    out.push(<polygon key="cone" points={`${a[0] - 5},${a[1] - 1} ${a[0] + 5},${a[1] - 1} ${a[0]},${a[1] - 12}`} fill="#f0a43a"/>);
  }
  const style = night && lit ? { filter: "drop-shadow(0 0 5px rgba(255,215,110,.5))" } : undefined;
  return <g style={style}>{out}</g>;
}

function Tree({ x, y, s = 1, night }: { x: number; y: number; s?: number; night: boolean }) {
  const [a, b] = P(x, y);
  return (
    <g>
      <rect x={a - 1.5} y={b - 9 * s} width={3} height={9 * s} fill={night ? "#2a2f3a" : "#8a6a4d"}/>
      <circle cx={a} cy={b - 14 * s} r={8 * s} fill={night ? "#1f6b52" : "#3fa866"}/>
      <circle cx={a - 3} cy={b - 17 * s} r={5 * s} fill={night ? "#2a8a63" : "#63c985"}/>
    </g>
  );
}

type Props = {
  medals: MedalState[]; records: Record<string, number>; level: number; houses: number; onOpen: (m: MedalState) => void;
};

export default function CityView({ medals, records, level, houses, onOpen }: Props) {
  const [night, setNight] = useState(false);
  const [zoom, setZoom] = useState(1);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let pref: string | null = null;
    try { pref = localStorage.getItem("filo-city-night"); } catch {}
    const h = new Date().getHours();
    setNight(pref === "1" ? true : pref === "0" ? false : h >= 19 || h < 7);
  }, []);
  const toggleNight = () => {
    setNight((n) => { try { localStorage.setItem("filo-city-night", n ? "0" : "1"); } catch {} return !n; });
  };

  const blocks = Math.min(COLS * 4, Math.max(3, 2 + level, ...medals.map((m, i) => ((records[m.def.id] ?? 0) > 0 || m.tier > 0 ? i + 1 : 0))));
  const rows = Math.ceil(blocks / COLS);
  const W = COLS * PITCH + 1, H = rows * PITCH + 1;

  const { ground, items, built, dark } = useMemo(() => {
    const look: Look = { night };
    const gr: React.ReactNode[] = [];
    const it: { depth: number; node: React.ReactNode }[] = [];
    const owned = (bi: number) => bi < blocks;
    const minorSlots: { x: number; y: number; bi: number }[] = [];
    let built = 0, dark = 0;

    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
      const road = tx % PITCH === 0 || ty % PITCH === 0;
      const bi = road ? -1 : Math.floor((ty - 1) / PITCH) * COLS + Math.floor((tx - 1) / PITCH);
      const locked = !road && !owned(bi);
      const fill = road ? (night ? "#0f1a28" : "#efe9da") : locked ? (night ? "#13233a" : "#cfe4cf") : (tx + ty) % 2 ? (night ? "#183452" : "#8fd68c") : (night ? "#1a3857" : "#9bdc97");
      gr.push(<polygon key={`g${tx}-${ty}`} points={pts([P(tx, ty), P(tx + 1, ty), P(tx + 1, ty + 1), P(tx, ty + 1)])} fill={fill} stroke={locked ? (night ? "rgba(120,255,220,.14)" : "rgba(80,120,80,.25)") : "none"} strokeDasharray={locked ? "3 3" : undefined} strokeWidth={0.8}/>);
      if (road && night && tx % PITCH === 0 && ty % PITCH !== 0) {
        const a = P(tx + 0.5, ty + 0.15), b = P(tx + 0.5, ty + 0.85);
        gr.push(<line key={`rl${tx}-${ty}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#2de2c0" strokeWidth={1} strokeDasharray="3 4" opacity={0.55}/>);
      }
      if (road && night && ty % PITCH === 0 && tx % PITCH !== 0) {
        const a = P(tx + 0.15, ty + 0.5), b = P(tx + 0.85, ty + 0.5);
        gr.push(<line key={`rh${tx}-${ty}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#2de2c0" strokeWidth={1} strokeDasharray="3 4" opacity={0.55}/>);
      }
    }
    // bordo della piattaforma
    gr.push(<polygon key="ed1" points={pts([P(0, H), P(W, H), P(W, H, -12), P(0, H, -12)])} fill={night ? "#0a1524" : "#5fae68"}/>);
    gr.push(<polygon key="ed2" points={pts([P(W, 0), P(W, H), P(W, H, -12), P(W, 0, -12)])} fill={night ? "#08111d" : "#4c9657"}/>);

    for (let bi = 0; bi < blocks; bi++) {
      const col = bi % COLS, row = Math.floor(bi / COLS);
      const ox = 1 + col * PITCH, oy = 1 + row * PITCH;
      const m = medals[bi];
      for (const [dx, dy] of [[2, 0], [2, 1], [2, 2], [0, 2], [1, 2]]) minorSlots.push({ x: ox + dx, y: oy + dy, bi });
      if (!m) {
        // isolato verde: alberi
        for (const [dx, dy] of [[0.5, 0.5], [1.5, 0.6], [0.6, 1.5], [1.5, 1.5]]) it.push({ depth: ox + dx + oy + dy, node: <Tree key={`pt${bi}-${dx}-${dy}`} x={ox + dx} y={oy + dy} s={0.9} night={night}/> });
        continue;
      }
      const rec = Math.max(records[m.def.id] ?? 0, m.tier);
      const fam = m.def.family;
      if (rec === 0) {
        // lotto da costruire: bordo tratteggiato e fondamenta
        gr.push(<polygon key={`lot${bi}`} points={pts([P(ox + 0.1, oy + 0.1), P(ox + 1.9, oy + 0.1), P(ox + 1.9, oy + 1.9), P(ox + 0.1, oy + 1.9)])} fill={night ? "rgba(120,255,220,.06)" : "rgba(255,255,255,.35)"} stroke={night ? "rgba(120,255,220,.5)" : "#ffffff"} strokeWidth={1.4} strokeDasharray="4 3"/>);
        const c = P(ox + 1, oy + 1);
        it.push({ depth: ox + 2 + oy + 2, node: (
          <g key={`lotc${bi}`} onClick={() => onOpen(m)} style={{ cursor: "pointer" }} role="button" aria-label={`${m.def.name}: da costruire`}>
            <circle cx={c[0]} cy={c[1] - 4} r={10} fill={night ? "#0f1d30" : "#ffffff"} stroke={FAM[fam]} strokeWidth={2}/>
            <text x={c[0]} y={c[1]} textAnchor="middle" fontSize="13" fontWeight="800" fill={FAM[fam]}>+</text>
          </g>
        ) });
        continue;
      }
      const risky = m.riskNeed !== null || m.tier < rec;
      const lit = !risky;
      built++; if (!lit) dark++;
      const tall = fam === "Efficacia" ? 1.25 : 1;
      const h = (18 + rec * 13) * tall;
      const roof: BoxOpts["roof"] = fam === "Costanza" || fam === "Impegno" ? "pitch" : fam === "Equilibrio" ? "garden" : fam === "Efficacia" ? "tank" : "flat";
      it.push({ depth: ox + 2 + oy + 2, node: (
        <g key={`m${bi}`} onClick={() => onOpen(m)} style={{ cursor: "pointer" }} role="button" tabIndex={0} aria-label={`${m.def.name}: ${lit ? "attiva" : "da riaccendere"}`}
           onKeyDown={(e) => { if (e.key === "Enter") onOpen(m); }}>
          <Building look={look} o={{ x: ox + 0.1, y: oy + 0.1, w: 1.8, d: 1.8, h, c: FAM[fam], rc: ROOF[fam], roof, lit, scaf: !lit, spire: fam === "Efficacia" && rec >= 4, flag: fam === "Impegno" && rec >= 3, gold: rec >= 5 }}/>
        </g>
      ) });
    }

    // case: una per sfida completata, negli spazi minori
    const hcount = Math.min(houses, minorSlots.length);
    for (let i = 0; i < minorSlots.length; i++) {
      const s = minorSlots[i];
      if (i < hcount) {
        const col = HOUSE_COL[hash(s.x, s.y) % HOUSE_COL.length];
        built++;
        it.push({ depth: s.x + 1 + s.y + 1, node: <Building key={`h${i}`} look={look} o={{ x: s.x + 0.2, y: s.y + 0.2, w: 0.6, d: 0.6, h: 14 + (hash(s.y, s.x) % 3) * 4, c: col, rc: "#b5472f", roof: "pitch", lit: true, floors: 1 }}/> });
      } else if (hash(s.x, s.y) % 5 < 3) {
        it.push({ depth: s.x + 0.5 + s.y + 0.5, node: <Tree key={`t${i}`} x={s.x + 0.5} y={s.y + 0.5} s={0.8} night={night}/> });
      }
    }
    it.sort((a, b) => a.depth - b.depth);
    return { ground: gr, items: it, built, dark };
  }, [night, blocks, medals, records, houses, onOpen, H, W]);

  const minX = -H * TW - 20, maxX = W * TW + 20;
  const minY = -150, maxY = (W + H) * TH + 24;
  const vw = maxX - minX, vh = maxY - minY;
  const width = Math.max(vw * 0.54 * zoom, 0);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2);
  }, [zoom, rows]);

  return (
    <div className={night ? "city-box night" : "city-box"}>
      <div className="city-chips">
        <span className="chip">{built} {built === 1 ? "edificio" : "edifici"}</span>
        {dark > 0 && <span className="chip warn">{dark} da riaccendere</span>}
        {built === 0 && <span className="chip">Studia per costruire il primo</span>}
      </div>
      <div className="city-scroll" ref={scroller}>
        <svg viewBox={`${minX} ${minY} ${vw} ${vh}`} width={width} height={(width * vh) / vw} role="img" aria-label="La tua città di studio">
          {ground}
          {items.map((i, k) => <g key={k}>{i.node}</g>)}
        </svg>
      </div>
      <div className="city-ctl">
        <button onClick={() => setZoom((z) => Math.max(0.7, +(z - 0.2).toFixed(1)))} aria-label="Rimpicciolisci"><Minus size={18}/></button>
        <button onClick={() => setZoom((z) => Math.min(2, +(z + 0.2).toFixed(1)))} aria-label="Ingrandisci"><Plus size={18}/></button>
        <button onClick={toggleNight} aria-label={night ? "Mostra di giorno" : "Mostra di sera"}>{night ? <Sun size={18}/> : <Moon size={18}/>}</button>
      </div>
    </div>
  );
}
