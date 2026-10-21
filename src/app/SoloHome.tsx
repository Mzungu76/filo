"use client";

import { Play, ChevronRight } from "lucide-react";
import type { Preset } from "@/lib/workload";
import TimerFace, { styleVars } from "./TimerFaces";

type Props = {
  styleIdx: number; mode: string; shown: number; ringValue: number; timerLabel: string;
  work: number; rest: number; level: string; choosePreset: (p: Preset) => void | Promise<void>;
  onPlay: () => void; openSession: () => void; formatTime: (s: number) => string;
  silentMissing: boolean; grantSilent: () => void;
};

const CHOICES: { p: Preset; label: string; level: string }[] = [
  { p: "many", label: "15", level: "many" }, { p: "medium", label: "20", level: "medium" }, { p: "few", label: "25", level: "few" }
];

/** filò: solo il timer. Un timer diverso (forma e colori) a ogni nuovo blocco. */
export default function SoloHome(p: Props) {
  return (
    <div className="solo" style={styleVars(p.styleIdx)}>
      <div className="solo-ring">
        <TimerFace index={p.styleIdx} value={p.ringValue}>
          <div className="big-center">
            <span className="big-state"><span className={`status-dot ${p.mode}`}></span>{p.mode === "idle" ? "Pronto" : p.timerLabel}</span>
            <span className="big-time">{p.formatTime(p.shown)}</span>
            <span className="big-plan">{p.work} min · poi pausa {p.rest}</span>
          </div>
        </TimerFace>
        {p.mode === "idle"
          ? <button className="play-btn" onClick={p.onPlay} aria-label="Inizia"><Play size={40} fill="currentColor"/></button>
          : <button className="play-btn wide" onClick={p.openSession}>Apri</button>}
      </div>

      {p.mode === "idle" && (
        <div className="solo-mins" role="group" aria-label="Minuti di studio">
          {CHOICES.map((c) => (
            <button key={c.p} className={p.level === c.level ? "on" : ""} onClick={() => void p.choosePreset(c.p)}>{c.label}<small>min</small></button>
          ))}
        </div>
      )}

      {p.silentMissing && (
        <button className="fh-silent" onClick={p.grantSilent}>
          <span><b>Attiva il blocco notifiche</b><small>Un tocco: scegli filò e attiva “Consenti”</small></span>
          <ChevronRight size={20}/>
        </button>
      )}
    </div>
  );
}
