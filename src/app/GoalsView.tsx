"use client";

import { useState } from "react";
import { Gift, X } from "lucide-react";
import Medal, { LevelBadge } from "./Medal";
import { LEVELS, TIER_NAMES, WINDOW_DAYS, type Challenge, type MedalState, type Tier } from "@/lib/goals";

type Props = {
  level: ReturnType<typeof import("@/lib/goals").levelOf>;
  points: number;
  rhythm: { score: number; days: number; label: string };
  medals: MedalState[];
  curStreak: number;
  daysThisWeek: number;
  records: Record<string, number>;
  challenges: { c: Challenge; progress: number; done: boolean }[];
  reward: { text: string; need: number };
  doneCount: number;
  rewardReady: boolean;
  onClaim: () => void;
  onEditReward: () => void;
};

const TIER = TIER_NAMES;

/** Cosa serve, in concreto, per non perdere la medaglia nei prossimi 7 giorni. */
function keepText(m: MedalState, daysThisWeek: number) {
  if (m.def.id === "streak") {
    const n = Math.max(1, 3 - daysThisWeek);
    return `studia ancora ${n} ${n === 1 ? "giorno" : "giorni"} questa settimana`;
  }
  const n = m.riskNeed ?? 0;
  if (m.def.unit === "min") return n >= 60 ? `ancora ${Math.ceil(n / 60)} h di studio` : `ancora ${n} min di studio`;
  const one: Record<string, string> = { blocchi: "blocco", giorni: "giorno", sessioni: "sessione", volte: "volta", compiti: "compito", materie: "materia" };
  return `ancora ${n} ${n === 1 ? one[m.def.unit] ?? m.def.unit : m.def.unit}`;
}

export default function GoalsView(p: Props) {
  const [open, setOpen] = useState<MedalState | null>(null);
  const earned = p.medals.filter((m) => m.tier > 0).length;
  const atRisk = p.medals.filter((m) => m.riskNeed !== null);
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

      {atRisk.length > 0 && (
        <div className="stat-block">
          <h2>Da mantenere</h2>
          <p className="stat-note" style={{ marginTop: 0, marginBottom: 10 }}>Le medaglie contano le ultime {WINDOW_DAYS / 7} settimane: queste scenderebbero di livello entro 7 giorni se ti fermi.</p>
          <div className="keep-list">
            {atRisk.map((m) => (
              <button className="keep-item" key={m.def.id} onClick={() => setOpen(m)}>
                <Medal icon={m.def.icon} tier={m.tier} size={40}/>
                <div><strong>{m.def.name} · {TIER[m.tier]}</strong><span>Per mantenerla: {keepText(m, p.daysThisWeek)}.</span></div>
              </button>
            ))}
          </div>
        </div>
      )}

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
                <button className={`${m.tier > 0 ? "medal-cell" : "medal-cell locked"}${m.riskNeed !== null ? " risk" : ""}`} key={m.def.id} onClick={() => setOpen(m)} aria-label={`${m.def.name}: ${TIER[m.tier]}${m.riskNeed !== null ? ", a rischio" : ""}`}>
                  <Medal icon={m.def.icon} tier={m.tier} size={68} record={(p.records[m.def.id] ?? 0) as Tier}/>
                  <span className="medal-name">{m.def.name}</span>
                  <span className="medal-prog"><i style={{ width: `${m.pct}%` }}/></span>
                  {m.riskNeed !== null ? <span className="risk-chip">A rischio</span> : (p.records[m.def.id] ?? 0) > m.tier ? <span className="medal-sub">Record: {TIER[p.records[m.def.id]]}</span> : <span className="medal-sub">{m.next === null ? "Massimo!" : `${m.def.unit === "min" ? Math.round(m.value / 60) : m.value}/${m.def.unit === "min" ? Math.round(m.next / 60) : m.next}${m.def.unit === "min" ? " h" : ""}`}</span>}
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
            <Medal icon={open.def.icon} tier={open.tier} size={110} record={(p.records[open.def.id] ?? 0) as Tier}/>
            <h2>{open.def.name}</h2>
            <p className="subhead">{open.tier === 0 ? "Da ottenere" : `Livello attuale: ${TIER[open.tier]}`}{(p.records[open.def.id] ?? 0) > open.tier ? ` · Record: ${TIER[p.records[open.def.id]]}` : ""}</p>
            <p className="medal-why">{open.def.why}</p>
            <div className="tier-list">
              {open.def.tiers.map((t, i) => (
                <div key={t} className={open.tier > i ? "tier-row got" : "tier-row"}>
                  <Medal icon={open.def.icon} tier={(i + 1) as Tier} size={34}/>
                  <span><b className="tier-name">{TIER[i + 1]}</b> · {open.def.how(t)}</span>
                  <b>{open.tier > i ? "✓" : ""}</b>
                </div>
              ))}
            </div>
            {open.riskNeed !== null && <p className="risk-chip" style={{ display: "block", margin: "0 0 12px", padding: "8px 12px", borderRadius: 12 }}>A rischio: per mantenerla, {keepText(open, p.daysThisWeek)} entro 7 giorni.</p>}
            <p className="stat-note" style={{ margin: "0 0 12px" }}>{open.def.id === "streak" ? "Conta la serie attuale." : `Conta ciò che fai nelle ultime ${WINDOW_DAYS / 7} settimane: va mantenuta.`} Valore ora: {open.def.unit === "min" ? `${Math.round(open.value / 60)} h` : open.value}.</p>
            {open.def.id === "streak" && <p className="stat-note">Serie attuale: {p.curStreak} {p.curStreak === 1 ? "settimana" : "settimane"}. La medaglia ottenuta resta tua; la serie va mantenuta per salire.</p>}
          </section>
        </div>
      )}
    </section>
  );
}
