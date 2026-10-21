"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Moon, Plus, Sun } from "lucide-react";
import type { MedalState } from "@/lib/goals";
import { BuildingShape, BUILDING_NAME, House, P, TH, TW } from "./Buildings";

// La città nasce da quello che fai: ogni traguardo è un edificio (cresce col livello migliore
// raggiunto), ogni sfida completata una casa, ogni livello un nuovo isolato.
// Stile "flat" isometrico; di sera passa al neon.

const COLS = 4;          // isolati per riga
const PITCH = 4;         // lato di un isolato (3 tessere) + strada (1)
const HOUSE_COL = ["#f28a3b", "#3f8fd6", "#f4c43a", "#3fc491", "#e5584f", "#a77ad8"];
const pts = (a: [number, number][]) => a.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

const hash = (a: number, b: number) => { let h = (a * 374761393 + b * 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return (h ^ (h >>> 16)) >>> 0; };

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
      if (rec === 0) {
        // lotto da costruire: bordo tratteggiato e fondamenta
        gr.push(<polygon key={`lot${bi}`} points={pts([P(ox + 0.1, oy + 0.1), P(ox + 1.9, oy + 0.1), P(ox + 1.9, oy + 1.9), P(ox + 0.1, oy + 1.9)])} fill={night ? "rgba(120,255,220,.06)" : "rgba(255,255,255,.35)"} stroke={night ? "rgba(120,255,220,.5)" : "#ffffff"} strokeWidth={1.4} strokeDasharray="4 3"/>);
        it.push({ depth: ox + 2 + oy + 2, node: (
          <g key={`lotc${bi}`} onClick={() => onOpen(m)} style={{ cursor: "pointer" }} role="button" tabIndex={0} aria-label={`${BUILDING_NAME[m.def.icon]}: da costruire`}
             onKeyDown={(e) => { if (e.key === "Enter") onOpen(m); }} opacity={night ? 0.35 : 0.42}>
            <BuildingShape x={ox + 0.1} y={oy + 0.1} kind={m.def.icon} tier={1} lit={false} night={night}/>
          </g>
        ) });
        continue;
      }
      const risky = m.riskNeed !== null || m.tier < rec;
      const lit = !risky;
      built++; if (!lit) dark++;
      it.push({ depth: ox + 2 + oy + 2, node: (
        <g key={`m${bi}`} onClick={() => onOpen(m)} style={{ cursor: "pointer" }} role="button" tabIndex={0} aria-label={`${BUILDING_NAME[m.def.icon]}: ${lit ? "attivo" : "da riaccendere"}`}
           onKeyDown={(e) => { if (e.key === "Enter") onOpen(m); }}>
          <BuildingShape x={ox + 0.1} y={oy + 0.1} kind={m.def.icon} tier={rec} lit={lit} scaf={!lit} night={night}/>
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
        it.push({ depth: s.x + 1 + s.y + 1, node: <House key={`h${i}`} x={s.x} y={s.y} col={col} h={14 + (hash(s.y, s.x) % 3) * 4} night={night}/> });
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
  const width = Math.max(vw * 0.7 * zoom, 0);

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
