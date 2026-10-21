export type Phase = "work" | "break";
export type Plan = { work: number; rest: number };

/**
 * Fa avanzare il timer fino a `now`, anche se l'app è rimasta sospesa per più fasi
 * (blocco → pausa → blocco…). Dopo ogni pausa si riparte con un nuovo blocco.
 * `workMs` è il tempo di studio trascorso tra `last` e `now`.
 */
export function advance(phase: Phase, endAt: number, last: number, now: number, plan: Plan) {
  let p = phase;
  let end = endAt;
  let from = last;
  let workMs = 0;
  let crossed = 0;
  while (now >= end) {
    if (p === "work") workMs += Math.max(0, end - from);
    from = end;
    p = p === "work" ? "break" : "work";
    end += (p === "work" ? plan.work : plan.rest) * 60000;
    crossed++;
  }
  if (p === "work") workMs += Math.max(0, now - from);
  return { phase: p, endAt: end, workMs, crossed };
}
