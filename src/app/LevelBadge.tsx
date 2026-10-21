"use client";

/** Piccolo distintivo del livello (numero dentro un disco dorato). */
export function LevelBadge({ level, size = 44 }: { level: number; size?: number }) {
  return <span className="lvl-badge" style={{ width: size, height: size, fontSize: size * 0.46 }}>{level}</span>;
}
