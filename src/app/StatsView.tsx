"use client";

import { Lightbulb, Sparkles } from "lucide-react";
import type { Stats } from "@/lib/stats";

function fmt(minutes: number) {
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
}

function Bars({ rows }: { rows: { label: string; value: number; hint?: string; strong?: boolean }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="hbars">
      {rows.map((r) => (
        <div className="hbar" key={r.label}>
          <span className="hbar-label">{r.label}</span>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${(r.value / max) * 100}%`, background: r.strong ? "#4c9876" : undefined }}/></div>
          <span className="hbar-value">{r.hint ?? fmt(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function StatsView({ stats, quote }: { stats: Stats; quote: string | null }) {
  const { week, bars, buckets, bestBucket, subjects, tasks, focus, tips } = stats;
  const delta = week.prevMinutes > 0 ? Math.round(((week.minutes - week.prevMinutes) / week.prevMinutes) * 100) : null;
  const maxBar = Math.max(1, ...bars.map((b) => b.minutes));
  const subjectsWithTime = subjects.filter((s) => s.minutes > 0);

  if (!stats.hasData) {
    return (
      <section className="stats-page">
        <p className="eyebrow">STATISTICHE</p>
        <h1>Ancora niente da mostrare.</h1>
        <p className="subhead">Le statistiche compaiono dopo la tua prima sessione: tempo di studio, momenti migliori, materie e consigli su misura.</p>
        {quote && <p className="quote">{quote}</p>}
      </section>
    );
  }

  return (
    <section className="stats-page">
      <p className="eyebrow">QUESTA SETTIMANA</p>
      <div className="stat-hero">
        <strong>{fmt(week.minutes)}</strong>
        {delta !== null && <span className={delta >= 0 ? "delta up" : "delta down"}>{delta >= 0 ? "+" : "−"}{Math.abs(delta)}% sulla scorsa settimana</span>}
      </div>
      <div className="summary-grid">
        <div className="summary-card"><span>Giorni di studio</span><strong>{week.activeDays}<small>/{week.elapsedDays}</small></strong></div>
        <div className="summary-card"><span>Sessioni</span><strong>{week.sessions}</strong></div>
        <div className="summary-card"><span>Compiti chiusi</span><strong>{week.doneTasks}</strong></div>
      </div>

      {tips.length > 0 ? (
        <div className="tips">
          <h2>{tips.some((t) => t.tone === "improve") ? "Come migliorare" : "Come stai andando"}</h2>
          {tips.map((t) => (
            <div className={`tip ${t.tone}`} key={t.id}>
              <span className="tip-icon">{t.tone === "improve" ? <Lightbulb size={16}/> : <Sparkles size={16}/>}</span>
              <div><strong>{t.title}</strong><p>{t.text}</p></div>
            </div>
          ))}
        </div>
      ) : quote ? <p className="quote">{quote}</p> : null}

      <div className="stat-block">
        <h2>Ultimi 7 giorni</h2>
        <div className="vbars" role="img" aria-label="Minuti di studio negli ultimi 7 giorni">
          {bars.map((b) => (
            <div className="vbar" key={b.date}>
              <span className="vbar-value">{b.minutes > 0 ? b.minutes : ""}</span>
              <div className="vbar-track"><div className={b.isToday ? "vbar-fill today" : "vbar-fill"} style={{ height: `${(b.minutes / maxBar) * 100}%` }}/></div>
              <span className={b.isToday ? "vbar-label today" : "vbar-label"}>{b.label}</span>
            </div>
          ))}
        </div>
      </div>

      {subjectsWithTime.length > 0 && (
        <div className="stat-block">
          <h2>Tempo per materia</h2>
          <Bars rows={subjectsWithTime.map((s) => ({ label: s.subject, value: s.minutes }))}/>
          <p className="stat-note">Conta il tempo passato sul compito selezionato. Materie con compiti ancora aperti: {subjects.filter((s) => s.open > 0).map((s) => `${s.subject} (${s.open})`).join(", ") || "nessuna"}.</p>
        </div>
      )}

      {bestBucket && (
        <div className="stat-block">
          <h2>Quando studi meglio</h2>
          <Bars rows={buckets.map((b) => ({ label: b.label, value: b.minutes, strong: b.key === bestBucket.key }))}/>
          <p className="stat-note">Ultime 4 settimane, in base all’ora di inizio delle sessioni. Mattina: fino alle 13 · Pomeriggio: 13–18 · Sera: 18–22 · Notte: dopo le 22.</p>
        </div>
      )}

      <div className="stat-block">
        <h2>Compiti</h2>
        <div className="summary-grid">
          <div className="summary-card"><span>Chiusi in tempo</span><strong>{tasks.onTimePct === null ? "–" : `${tasks.onTimePct}%`}</strong></div>
          <div className="summary-card"><span>Scaduti aperti</span><strong>{tasks.overdueOpen}</strong></div>
          <div className="summary-card"><span>Per oggi o domani</span><strong>{tasks.dueSoon}</strong></div>
        </div>
        <p className="stat-note">“Chiusi in tempo” considera i compiti con scadenza chiusi nelle ultime 2 settimane.</p>
      </div>

      {(focus.avgSessionMin !== null) && (
        <div className="stat-block">
          <h2>Concentrazione</h2>
          <div className="summary-grid">
            <div className="summary-card"><span>Durata media</span><strong>{focus.avgSessionMin}<small> min</small></strong></div>
            {focus.avgBlocks !== null && <div className="summary-card"><span>Blocchi a sessione</span><strong>{focus.avgBlocks}</strong></div>}
            {focus.distractionsPerSession !== null && <div className="summary-card"><span>Interruzioni a sessione</span><strong>{focus.distractionsPerSession}</strong></div>}
          </div>
          <p className="stat-note">Dati delle ultime 2 settimane. Le interruzioni contano le volte in cui hai provato ad aprire un’app bloccata.</p>
        </div>
      )}
    </section>
  );
}
