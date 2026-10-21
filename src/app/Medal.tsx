"use client";

import { CalendarCheck, CalendarRange, Clock3, Hourglass, Layers, Link2, ListChecks, Moon, Mountain, Rocket, ShieldCheck, Target, Undo2 } from "lucide-react";
import type { MedalIcon, Tier } from "@/lib/goals";

const ICONS: Record<MedalIcon, typeof Clock3> = {
  hourglass: Hourglass, clock: Clock3, calendar: CalendarCheck, week: CalendarRange, link: Link2, shield: ShieldCheck,
  undo: Undo2, mountain: Mountain, target: Target, list: ListChecks, rocket: Rocket, moon: Moon, layers: Layers
};

/** Medaglia: disco metallico (bronzo/argento/oro) con nastro, riflesso animato e icona. `pop` la fa comparire con festa. */
export default function Medal({ icon, tier, size = 76, pop = false, record }: { icon: MedalIcon; tier: Tier; size?: number; pop?: boolean; record?: Tier }) {
  const Icon = ICONS[icon];
  return (
    <span className={`medal t${tier}${pop ? " pop" : ""}`} style={{ width: size, height: size }} aria-hidden="true">
      <span className="medal-ribbon"/>
      <span className="medal-disc">
        <Icon size={Math.round(size * 0.4)} strokeWidth={2.1}/>
        {tier > 0 && <span className="medal-shine"/>}
      </span>
      {record !== undefined && record > tier && <span className={`medal-record t${record}`} title="Il tuo record"/>}
      {pop && Array.from({ length: 8 }, (_, i) => <i className="spark" style={{ "--a": `${i * 45}deg`, "--d": `${i % 2 ? 0.05 : 0}s` } as React.CSSProperties} key={i}/>)}
    </span>
  );
}

/** Piccolo distintivo del livello (numero dentro un disco dorato). */
export function LevelBadge({ level, size = 44 }: { level: number; size?: number }) {
  return <span className="lvl-badge" style={{ width: size, height: size, fontSize: size * 0.46 }}>{level}</span>;
}
