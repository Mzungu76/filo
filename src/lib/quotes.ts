export type QuoteKind = "start" | "break" | "done" | "end" | "blocked" | "idle";

// Frasi originali (nessuna attribuita a persone reali): brevi, concrete, senza prediche.
const QUOTES: Record<QuoteKind, string[]> = {
  start: [
    "Non devi sentirti pronto. Devi solo iniziare: la voglia, spesso, arriva dopo i primi cinque minuti.",
    "Un blocco è piccolo apposta: stai promettendo pochi minuti, non tutto il pomeriggio.",
    "Il cervello detesta le cose enormi. Per questi minuti esiste un solo compito.",
    "Un primo passo imperfetto batte un passo perfetto mai fatto.",
    "Rendi facile iniziare: apri il quaderno, scrivi la data. Il resto segue da solo.",
    "La concentrazione si allena a blocchi, non a maratone.",
    "Se la mente scappa, riportala con gentilezza. Il ritorno è l'allenamento, non l'errore.",
    "Quello che stai per fare conta meno della scelta di farlo adesso."
  ],
  break: [
    "La pausa non è tempo perso: è lì che il cervello mette in ordine ciò che hai appena fatto.",
    "Alzati, bevi un bicchiere d'acqua, guarda fuori dalla finestra. Meglio se lontano da uno schermo.",
    "Hai finito un blocco intero: riposa senza sensi di colpa, te la sei guadagnata.",
    "Due minuti di movimento riposano più di dieci minuti di telefono.",
    "Respira lentamente tre volte. Poi, quando suona, riparti da dove eri.",
    "Se durante il blocco ti è venuta un'idea, scrivila e lasciala lì: sarà ancora tua dopo.",
    "Per adesso il tuo unico compito è riposare. Il prossimo blocco sarà più leggero."
  ],
  done: [
    "Un compito in meno è un pensiero in meno. Fermati un secondo e notalo.",
    "Chiudere le cose è una competenza, e ti stai allenando.",
    "Fatto. Il te di domani ti ringrazia.",
    "Non era enorme: lo era diventato solo nella testa. Adesso è chiuso.",
    "Ogni spunta è una prova concreta che ce la fai, anche nei giorni pesanti.",
    "Quello che hai appena chiuso non torna indietro: è guadagnato."
  ],
  end: [
    "Quello che conta non è quanto hai fatto, ma che sei tornato a farlo.",
    "Anche un solo blocco vale: la costanza si costruisce con giorni normali, non eroici.",
    "Prima di staccare, scrivi dove riparti domani: sarai più leggero.",
    "Hai lavorato per il te di domani. Adesso riposa davvero.",
    "Un buon pomeriggio non si misura in ore, ma nel sentirti a posto."
  ],
  blocked: [
    "Il messaggio può aspettare pochi minuti. Il tuo focus, una volta perso, costa molto di più a ricostruirsi.",
    "Ogni volta che resisti, la volta dopo costa meno.",
    "Quella app è progettata per catturarti. Tu stai scegliendo chi decide.",
    "Non è forza di volontà infinita: è solo aspettare la pausa, che arriva presto."
  ],
  idle: [
    "Il momento giusto per iniziare quasi mai arriva da solo: lo si crea con il primo blocco.",
    "Parti dal compito più piccolo: darà slancio a quelli più grandi.",
    "Non serve una giornata perfetta, serve un blocco fatto bene."
  ]
};

let last: Partial<Record<QuoteKind, number>> = {};

/** Una frase a caso della categoria, evitando di ripetere subito la stessa. */
export function pickQuote(kind: QuoteKind): string {
  const list = QUOTES[kind];
  let i = Math.floor(Math.random() * list.length);
  if (list.length > 1 && i === last[kind]) i = (i + 1) % list.length;
  last[kind] = i;
  return list[i];
}
