"use client";

import { useState } from "react";
import { Camera, Check, ChevronRight, PencilLine, Play, Trash2, X } from "lucide-react";
import type { Task } from "@/lib/db";
import type { ParsedTask } from "@/lib/didup";
import { LEVELS, type Preset } from "@/lib/workload";
import { BigRing } from "./ui";

type Props = {
  silentMissing: boolean; grantSilent: () => void;
  writeOpen: boolean; setWriteOpen: (v: boolean) => void;
  mode: string; shown: number; ringValue: number; timerLabel: string; planLabel: string;
  preset: Preset; choosePreset: (p: Preset) => void | Promise<void>;
  onPlay: () => void; openSession: () => void;
  open: Task[]; current: Task | undefined; setFocusId: (id: string) => void;
  toggleTask: (t: Task) => void | Promise<void>; deleteTask: (id: string) => void | Promise<void>;
  taskInput: string; setTaskInput: (v: string) => void; taskDate: string; setTaskDate: (v: string) => void;
  addTask: (e: React.FormEvent) => void | Promise<void>;
  native: boolean; reading: number | null; importImage: (e?: React.ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  importText: string; setImportText: (v: string) => void; preview: ParsedTask[]; skipped: number[]; setSkipped: (f: (s: number[]) => number[]) => void;
  toAdd: number; importTasks: () => void | Promise<void>; pasteFromClipboard: () => void | Promise<void>;
  formatTime: (s: number) => string; dueLabel: (d: number | undefined) => string; dayKey: (offset: number) => string;
};

/** Edizione "focus": un'unica schermata con il timer e due pulsanti grandi per caricare i compiti. */
export default function FocusHome(p: Props) {
  const [listOpen, setListOpen] = useState(false);
  const [added, setAdded] = useState(0);
  const scanning = p.reading !== null;
  const reviewing = !scanning && p.importText.trim().length > 0;

  const scanButton = p.native ? (
    <button className="fh-btn scan" onClick={() => void p.importImage()}><Camera size={26}/><span>Scansiona<small>da DidUP</small></span></button>
  ) : (
    <label className="fh-btn scan">
      <Camera size={26}/><span>Scansiona<small>da DidUP</small></span>
      <input type="file" accept="image/*" onChange={p.importImage} hidden/>
    </label>
  );

  return (
    <div className="fh">
      <div className="fh-top"><span className="fh-brand">filo</span></div>

      <div className="fh-ring">
        <BigRing value={p.ringValue}>
          <div className="big-center">
            <span className="big-state"><span className={`status-dot ${p.mode}`}></span>{p.mode === "idle" ? "Pronto" : p.timerLabel}</span>
            <span className="big-time">{p.formatTime(p.shown)}</span>
            <span className="big-plan">{p.planLabel}</span>
          </div>
        </BigRing>
        {p.mode === "idle"
          ? <button className="play-btn" onClick={p.onPlay} aria-label="Inizia a studiare"><Play size={36} fill="currentColor"/></button>
          : <button className="play-btn wide" onClick={p.openSession}>Apri sessione</button>}
      </div>

      {p.mode === "idle" && (
        <div className="hp-row" role="group" aria-label="Ritmo di studio">
          {(["auto", "few", "medium", "many"] as Preset[]).map((k) => (
            <button key={k} className={p.preset === k ? "hp on" : "hp"} onClick={() => void p.choosePreset(k)}>{k === "auto" ? "Auto" : LEVELS[k].label}</button>
          ))}
        </div>
      )}

      {p.silentMissing && (
        <button className="fh-silent" onClick={p.grantSilent}>
          <span><b>Attiva il silenzioso automatico</b><small>Un tocco: poi scegli Filo Focus e attiva “Consenti”</small></span>
          <ChevronRight size={20}/>
        </button>
      )}

      <div className="fh-now">
        {p.current ? (
          <>
            <button className="fh-check" onClick={() => void p.toggleTask(p.current!)} aria-label="Segna come fatto"><Check size={22}/></button>
            <button className="fh-now-text" onClick={() => setListOpen(true)}>
              <small>Adesso · {p.open.length} da fare</small>
              <b>{p.current.title}</b>
            </button>
            <button className="fh-more" onClick={() => setListOpen(true)} aria-label="Vedi tutti i compiti"><ChevronRight size={22}/></button>
          </>
        ) : (
          <div className="fh-now-text empty"><small>Nessun compito</small><b>Aggiungili qui sotto</b></div>
        )}
      </div>

      <div className="fh-dock">
        {scanButton}
        <button className="fh-btn write" onClick={() => { setAdded(0); p.setWriteOpen(true); }}><PencilLine size={26}/><span>Scrivi<small>un compito</small></span></button>
      </div>

      {scanning && (
        <div className="fh-screen center"><div className="fh-spinner"/><p>Leggo l’immagine…{!p.native && p.reading! > 0 ? ` ${Math.round(p.reading! * 100)}%` : ""}</p></div>
      )}

      {reviewing && (
        <div className="fh-screen" role="dialog" aria-label="Compiti trovati">
          <div className="fh-head"><h2>{p.preview.length > 0 ? `Ho trovato ${p.preview.length} ${p.preview.length === 1 ? "compito" : "compiti"}` : "Non trovo compiti"}</h2>
            <button className="fh-x" onClick={() => { p.setImportText(""); p.setSkipped(() => []); }} aria-label="Annulla"><X size={22}/></button></div>
          <div className="fh-scroll">
            {p.preview.length === 0 && <p className="fh-help">Prova con uno screenshot più nitido della schermata “Compiti” di DidUP, oppure correggi il testo qui sotto.</p>}
            {p.preview.map((t, i) => (
              <label className="fh-row" key={i}>
                <input type="checkbox" checked={!p.skipped.includes(i)} onChange={() => p.setSkipped((s) => s.includes(i) ? s.filter((x) => x !== i) : [...s, i])}/>
                <span><b>{t.subject ?? "Compito"}</b>{t.dueDate !== undefined && <em> · {p.dueLabel(t.dueDate).replace(/^Per |^Scaduto · /, "")}</em>}<span className="fh-sub">{t.title}</span></span>
              </label>
            ))}
            <textarea className="fh-text" rows={4} value={p.importText} onChange={(e) => { p.setImportText(e.target.value); p.setSkipped(() => []); }} aria-label="Testo letto"/>
          </div>
          <div className="fh-foot">
            <button className="fh-big" disabled={p.toAdd === 0} onClick={() => void p.importTasks()}>Aggiungi {p.toAdd} {p.toAdd === 1 ? "compito" : "compiti"}</button>
          </div>
        </div>
      )}

      {p.writeOpen && (
        <div className="fh-screen" role="dialog" aria-label="Nuovo compito">
          <div className="fh-head"><h2>Nuovo compito</h2><button className="fh-x" onClick={() => p.setWriteOpen(false)} aria-label="Chiudi"><X size={22}/></button></div>
          <form className="fh-write" onSubmit={async (e) => { const form = e.currentTarget; if (p.taskInput.trim()) { await p.addTask(e); setAdded((n) => n + 1); form.querySelector("input")?.focus(); } else e.preventDefault(); }}>
            <input autoFocus value={p.taskInput} onChange={(e) => p.setTaskInput(e.target.value)} placeholder="Es. Matematica, es. 5 pag. 40" aria-label="Compito" maxLength={200} enterKeyHint="done"/>
            <div className="fh-dates" role="group" aria-label="Per quando">
              <button type="button" className={p.taskDate === p.dayKey(0) ? "chip on" : "chip"} onClick={() => p.setTaskDate(p.taskDate === p.dayKey(0) ? "" : p.dayKey(0))}>Oggi</button>
              <button type="button" className={p.taskDate === p.dayKey(1) ? "chip on" : "chip"} onClick={() => p.setTaskDate(p.taskDate === p.dayKey(1) ? "" : p.dayKey(1))}>Domani</button>
              <input type="date" value={p.taskDate} onChange={(e) => p.setTaskDate(e.target.value)} aria-label="Altra data"/>
            </div>
            <button className="fh-big" type="submit" disabled={!p.taskInput.trim()}>Aggiungi</button>
            {added > 0 && <p className="fh-help ok">{added} {added === 1 ? "aggiunto" : "aggiunti"} · scrivine un altro oppure chiudi con la X.</p>}
          </form>
        </div>
      )}

      {listOpen && (
        <div className="fh-screen" role="dialog" aria-label="Compiti da fare">
          <div className="fh-head"><h2>Da fare <span className="count">{p.open.length}</span></h2><button className="fh-x" onClick={() => setListOpen(false)} aria-label="Chiudi"><X size={22}/></button></div>
          <div className="fh-scroll">
            {p.open.length === 0 && <p className="fh-help">Nessun compito: scansionali o scrivili dalla schermata principale.</p>}
            {p.open.map((t) => (
              <div className={t.id === p.current?.id ? "fh-task cur" : "fh-task"} key={t.id}>
                <button className="fh-check" onClick={() => void p.toggleTask(t)} aria-label={`Fatto: ${t.title}`}><Check size={20}/></button>
                <button className="fh-task-body" onClick={() => { p.setFocusId(t.id); setListOpen(false); }}>
                  <b>{t.title}</b><small>{t.subject ? `${t.subject} · ` : ""}{p.dueLabel(t.dueDate)}</small>
                </button>
                <button className="fh-del" onClick={() => void p.deleteTask(t.id)} aria-label={`Elimina: ${t.title}`}><Trash2 size={18}/></button>
              </div>
            ))}
          </div>
          <div className="fh-foot two">{scanButton}<button className="fh-btn write" onClick={() => { setListOpen(false); setAdded(0); p.setWriteOpen(true); }}><PencilLine size={26}/><span>Scrivi<small>un compito</small></span></button></div>
        </div>
      )}
    </div>
  );
}
