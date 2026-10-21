# Filo MVP

PWA installabile per organizzare compiti, sessioni di concentrazione e pause, senza account e senza backend.

## Funzioni incluse

- Lista libera di compiti, senza materie preimpostate.
- Timer regolabile da 10 a 35 minuti.
- Pause regolabili da 5 a 15 minuti.
- Pausa, ripresa e chiusura manuale della sessione.
- Salvataggio locale tramite IndexedDB.
- Riepilogo delle sessioni e del tempo di studio.
- Manifest PWA, icona e service worker con cache di base.
- Richiesta del permesso notifiche e avvisi mentre l'app è attiva.
- Cancellazione di tutti i dati locali.

## Limiti noti della prima versione

1. Gli avvisi temporizzati sono gestiti dal timer della pagina. Se il browser sospende o termina la pagina, il timer può non attivarsi in tempo.
2. Le notifiche push affidabili con app chiusa richiedono un servizio push, sottoscrizioni e gestione delle chiavi VAPID. Non sono implementate in questa versione.
3. Il salvataggio è locale al browser/dispositivo. Non c'è sincronizzazione fra dispositivi.
4. Il service worker fornisce una cache di base; la prima apertura richiede una connessione.
5. Il riepilogo considera le sessioni chiuse nell'app, quindi è una stima utile, non un sistema di sorveglianza.

## Avvio locale

Richiede Node.js 20 o superiore.

```bash
npm install
npm run dev
```

Apri http://localhost:3000.

## Build

```bash
npm run build
npm start
```

## GitHub e Vercel

1. Crea un nuovo repository GitHub chiamato `filo-mvp`.
2. Estrai lo ZIP e carica tutti i file nella radice del repository.
3. In Vercel scegli **Add New → Project**, importa `filo-mvp` da GitHub e lascia le impostazioni Next.js predefinite.
4. Ogni push sul branch di produzione avvierà una nuova distribuzione.
5. Verifica l'installazione PWA su Android e iOS usando HTTPS.

## Test da fare prima di considerarla pronta

- Aggiungere, completare e cancellare compiti.
- Avviare, mettere in pausa, riprendere e chiudere una sessione.
- Ricaricare la pagina e verificare la persistenza dei dati.
- Provare la richiesta di notifiche su browser diversi.
- Installare la PWA su Android, iPhone e desktop.
- Verificare cosa succede se si chiude forzatamente il browser durante un timer.

## Privacy

Nessun account, analytics o invio dei compiti a un server applicativo. I dati sono salvati localmente nel browser. Cancellare i dati del sito o disinstallare il browser può rimuoverli.
