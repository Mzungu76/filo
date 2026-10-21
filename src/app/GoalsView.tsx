"use client";

import { useState } from "react";
import { Gift, X } from "lucide-react";
import Medal, { LevelBadge } from "./Medal";
import { LEVELS, type Challenge, type MedalState } from "@/lib/goals";

type Props = {
  level: ReturnType<typeof import("@/lib/goals").levelOf>;
  points: number;
  rhythm: { score: number; days: number; label: string };
  medals: MedalState[];
  curStreak: number;
  challenges: { c: Challenge; progress: number; done: boolean }[];
  reward: { text: string; need: number };
  doneCount: number;
  rewardReady: boolean;
  onClaim: () => void;
  onEditReward: () => void;
};

const TIER = ["Da ottenere", "Bronzo", "Argento", "Oro"];

export default function GoalsView(p: Props) {
  const [open, setOpen] = useState<MedalState | null>(null);
  const earned = p.medals.filter((m) => m.tier > 0).length;
  const families = ["Costanza", "Efficacia", "Organizzazione", "Equilibrio", "Impegno"] as const;

  return (
    <section className="goals-page">
      <p className="eyebrow">TRAGUARDI</p>
      <h1>Non perdere il filo.</h1>
      <p className="subhead">Ogni medaglia premia un modo di studiare che funziona davvero, non solo il tempo passato.</p>

      <div className="level-card">
        <LevelBadge level={p.level.level} size={64}/>
        <div className="level-info">
          <strong>{p.level.name}</strong>
          <span>{p.points} punti{p.level.nextName ? ` · ${p.level.toNext} al livello “${p.level.nextName}”` : " · livello massimo"}</span>
          <span className="strip-bar"><i style={{ width: `${p.level.pct}%` }}/></span>
        </div>
      </div>

      <div className="rhythm-card">
        <div className="rhythm-ring" style={{ "--p": `${p.rhythm.score}%` } as React.CSSProperties}><strong>{p.rhythm.score}</strong></div>
        <div>
          <strong>Ritmo: {p.rhythm.label}</strong>
          <p>Hai studiato {p.rhythm.days} giorni su 14. {p.rhythm.score >= 85 ? "Mantienilo: la regolarità è la tua forza." : "Cala piano se ti fermi e risale con un solo blocco."}{p.curStreak > 0 && ` Serie attiva: ${p.curStreak} ${p.curStreak === 1 ? "settimana" : "settimane"} da mantenere.`}</p>
        </div>
      </div>

      <div className="stat-block">
        <h2>Sfide della settimana</h2>
        <div className="challenges">
          {p.challenges.map(({ c, progress, done }) => (
            <div className={done ? "challenge done" : "challenge"} key={c.id}>
              <div className="challenge-top"><strong>{c.title}</strong><span>{done ? "Fatta ✓" : `${progress}/${c.target}`}</span></div>
              <span className="strip-bar"><i style={{ width: `${(progress / c.target) * 100}%` }}/></span>
            </div>
          ))}
        </div>
        <div className={p.rewardReady ? "reward-card ready" : "reward-card"}>
          <Gift size={20}/>
          {p.reward.text ? (
            <div>
              <strong>{p.rewardReady ? `Premio da ritirare: ${p.reward.text}` : `Premio: ${p.reward.text}`}</strong>
              <span>{p.rewardReady ? "Te lo sei guadagnato." : `Completa ${p.reward.need} ${p.reward.need === 1 ? "sfida" : "sfide"} questa settimana (${Math.min(p.doneCount, p.reward.need)}/${p.reward.need}).`}</span>
            </div>
          ) : (
            <div><strong>Scegli un premio</strong><span>Qualcosa di vero che ti piace: te lo ricordo io quando lo meriti.</span></div>
          )}
          {p.rewardReady
            ? <button className="install-go" onClick={p.onClaim}>Preso!</button>
            : <button className="secondary-light" onClick={p.onEditReward}>{p.reward.text ? "Cambia" : "Imposta"}</button>}
        </div>
      </div>

      <div className="stat-block">
        <h2>Medaglie <small className="count">{earned}/{p.medals.length}</small></h2>
        {families.map((f) => (
          <div key={f} className="medal-family">
            <p className="group-title">{f}</p>
            <div className="medal-grid">
              {p.medals.filter((m) => m.def.family === f).map((m) => (
                <button className={m.tier > 0 ? "medal-cell" : "medal-cell locked"} key={m.def.id} onClick={() => setOpen(m)} aria-label={`${m.def.name}: ${TIER[m.tier]}`}>
                  <Medal icon={m.def.icon} tier={m.tier} size={68}/>
                  <span className="medal-name">{m.def.name}</span>
                  <span className="medal-prog"><i style={{ width: `${m.pct}%` }}/></span>
                  <span className="medal-sub">{m.next === null ? "Oro!" : `${m.def.unit === "min" ? Math.round(m.value / 60) : m.value}/${m.def.unit === "min" ? Math.round(m.next / 60) : m.next}${m.def.unit === "min" ? " h" : ""}`}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="stat-block">
        <h2>Livelli</h2>
        <p className="stat-note">Punti: 10 per blocco completo (max 6 al giorno), +5 se senza interruzioni, 5 per compito chiuso (+3 se in tempo), +20 per sfida completata. {LEVELS.map((l, i) => `${i + 1} ${l.name} (${l.at})`).join(" · ")}.</p>
      </div>

      {open && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(null); }}>
          <section className="settings-modal medal-sheet" role="dialog" aria-modal="true" aria-label={open.def.name}>
            <button className="icon-btn sheet-close" onClick={() => setOpen(null)} aria-label="Chiudi"><X size={18}/></button>
            <Medal icon={open.def.icon} tier={open.tier} size={110}/>
            <h2>{open.def.name}</h2>
            <p className="subhead">{TIER[open.tier]}{open.tier === 0 ? "" : " ottenuto"}</p>
            <p className="medal-why">{open.def.why}</p>
            <div className="tier-list">
              {open.def.tiers.map((t, i) => (
                <div key={t} className={open.tier > i ? "tier-row got" : "tier-row"}>
                  <Medal icon={open.def.icon} tier={(i + 1) as 1 | 2 | 3} size={34}/>
                  <span>{open.def.how(t)}</span>
                  <b>{open.tier > i ? "✓" : ""}</b>
                </div>
              ))}
            </div>
            {open.def.id === "streak" && <p className="stat-note">Serie attuale: {p.curStreak} {p.curStreak === 1 ? "settimana" : "settimane"}. La medaglia ottenuta resta tua; la serie va mantenuta per salire.</p>}
          </section>
        </div>
      )}
    </section>
  );
}
