export type QuoteKind = "start" | "break" | "done" | "end" | "blocked" | "idle";

// Frasi semplici e dirette, o celebri (con l'autore): niente prediche.
const QUOTES: Record<QuoteKind, string[]> = {
  start: [
    "Un viaggio di mille miglia comincia con un singolo passo. — Lao Tzu",
    "Fatto è meglio che perfetto. — Sheryl Sandberg",
    "Comincia. La voglia arriva dopo.",
    "Affrettati lentamente. — Augusto",
    "Solo questo compito, solo questi minuti.",
    "Il modo per iniziare è smettere di parlare e cominciare a fare. — Walt Disney",
    "Apri il quaderno. Scrivi la data. Il resto viene da sé.",
    "Non pensare a tutto. Pensa al prossimo blocco."
  ],
  break: [
    "Il riposo è il condimento del lavoro. — Plutarco",
    "Alzati, bevi un po' d'acqua, guarda fuori.",
    "Telefono giù: due minuti di movimento riposano di più.",
    "Respira. Tra poco si riparte.",
    "Te la sei guadagnata.",
    "Se ti è venuta un'idea, scrivila e lasciala lì.",
    "Pausa vera: occhi lontani dallo schermo."
  ],
  done: [
    "Tutto sembra impossibile finché non viene fatto. — Nelson Mandela",
    "Uno in meno.",
    "Fatto. Spunta e respira.",
    "Sono dolci le fatiche passate. — Cicerone",
    "Un compito chiuso non torna indietro."
  ],
  end: [
    "Siamo ciò che facciamo ogni giorno. L'eccellenza è un'abitudine. — Will Durant",
    "La goccia scava la roccia non con la forza, ma cadendo spesso. — Ovidio",
    "Il successo è la somma di piccoli sforzi ripetuti giorno dopo giorno. — Robert Collier",
    "Anche un solo blocco conta.",
    "Scrivi dove riparti domani, poi stacca.",
    "Per oggi basta così. Bel lavoro."
  ],
  blocked: [
    "Non è che abbiamo poco tempo: ne sprechiamo molto. — Seneca",
    "Il messaggio può aspettare la pausa.",
    "Resisti ancora un po': la pausa arriva.",
    "Torna a Filo. Ci sei quasi."
  ],
  idle: [
    "Non c'è vento favorevole per chi non sa dove andare. — Seneca",
    "Parti dal compito più piccolo.",
    "Chi va piano va sano e va lontano.",
    "Basta un blocco fatto bene."
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
