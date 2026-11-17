# My Fitness & Futsal

Personal trainer digitale personale: PWA mobile-first, installabile sul telefono, in italiano.
Gestisce allenamenti in palestra con contatore manuale e timer, carichi e doppia progressione,
calcio a 5, misure corporee, foto prima/dopo, piano del nutrizionista, report PDF e un assistente
sui dati registrati.

```
frontend/            React 18 + TypeScript + Vite – PWA (IndexedDB, Service Worker, Three.js)
frontend/api/        funzione serverless Vercel (facoltativa) per l'assistente Claude
frontend/vercel.json configurazione Vercel (SPA, Service Worker, header di sicurezza)
supabase/setup.sql   bucket privato + regole RLS per i backup cifrati (facoltativo)
```

Tutto è pubblicato su **Vercel**. **Supabase** si usa solo se vuoi il backup/sincronizzazione nel cloud.
Senza Supabase l'app funziona completamente: i dati restano sul telefono (IndexedDB), anche offline.

> **Nessuna credenziale è nel codice.** Chiavi, URL e account si inseriscono da te: nelle variabili
> d'ambiente di Vercel oppure nelle impostazioni dell'app. L'assistente AI è spento di default
> (modalità "locale", nessun servizio esterno).

## 1. Pubblicazione su Vercel

1. Importa il repository su Vercel.
2. **Root Directory: `frontend`** (Framework: Vite). Build `npm run build`, output `dist` – già indicati in
   `frontend/vercel.json`.
3. Deploy. Nessuna variabile d'ambiente è obbligatoria.
4. Dal telefono apri l'URL `https://….vercel.app`:
   - **Android/Chrome**: menu ⋮ → *Installa app*;
   - **iPhone/Safari**: Condividi → *Aggiungi alla schermata Home*.

Ogni push ripubblica l'app; all'apertura compare "Nuova versione disponibile → Aggiorna".

## 2. Supabase (facoltativo: backup cifrato e sincronizzazione)

1. Crea un progetto su supabase.com (piano gratuito sufficiente).
2. SQL Editor → incolla ed esegui [`supabase/setup.sql`](supabase/setup.sql): crea il bucket privato
   `backups` e le regole che permettono a ogni utente di accedere solo alla propria cartella.
3. Nell'app: Profilo → **Cloud e sincronizzazione** → inserisci *Project URL* e chiave pubblica
   *anon/publishable* (Supabase → Project Settings → API), crea il tuo account, scegli una passphrase.
   In alternativa imposta in Vercel `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (valori pubblici).
4. In Supabase → Authentication, **disattiva le nuove registrazioni** dopo aver creato il tuo account.

I dati vengono cifrati sul telefono (AES-256-GCM, chiave derivata dalla passphrase con PBKDF2) prima
dell'invio: Supabase conserva solo file illeggibili. Vengono mantenute le ultime 10 versioni.
Non usare mai la chiave `service_role` nell'app.

## 3. Assistente AI (facoltativo, spento di default)

La specifica richiedeva un assistente che risponda sui dati registrati. Sono disponibili tre modalità
(Profilo → Assistente AI):

| Modalità | Cosa serve | Dati inviati |
|---|---|---|
| **Locale** (predefinita) | niente | nessuno: calcoli sul telefono, funziona offline |
| **Claude tramite Vercel** | variabili Vercel impostate da te + accesso Supabase | riepilogo testuale dei soli dati consentiti |
| **Claude con chiave personale** | una chiave API inserita nel telefono | riepilogo testuale dei soli dati consentiti |

Per la modalità Vercel imposta in *Project Settings → Environment Variables* (lato server):
`ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ALLOWED_EMAILS` (le email autorizzate) e,
facoltativo, `AI_MODEL` (predefinito `claude-opus-5-5`). La funzione `/api/ai/chat` resta spenta finché
`ANTHROPIC_API_KEY` e `ALLOWED_EMAILS` non sono impostate, e accetta solo utenti Supabase autenticati
presenti in `ALLOWED_EMAILS`: nessun altro può usare la chiave. Foto e documenti non vengono mai inviati.

## Tutto modificabile dall'app

| Cosa | Dove (Profilo) |
|---|---|
| Età, altezza, peso iniziale, sport, ruoli, infortuni, obiettivi, periodo | Dati personali e obiettivi |
| Attività di ogni giorno, scheda assegnata, durata | Programma settimanale |
| Esercizi, ordine, serie, ripetizioni/secondi, recuperi, riscaldamento, cardio, protezione gambe | Schede (+ ripristino del programma originale) |
| Nome, tipo, muscoli, note tecniche, immagine/GIF, link video, schema 3D, incremento minimo | Libreria esercizi |
| Fasi, date, RIR, settimane di scarico | Fasi e scarichi |
| Percentuali di progressione, soglia RIR, soglia di recupero | Progressione e recupero |
| Recuperi predefiniti, suoni, vibrazione, voce, notifiche, schermo acceso | Timer, suoni e notifiche |
| Modalità assistente, modello, consensi sui dati | Assistente AI |
| Supabase, account, passphrase, backup automatico | Cloud e sincronizzazione |
| PIN, biometria, blocco automatico | Sicurezza |
| Colore, dimensione testo, misure visibili | Aspetto |
| Backup cifrato, export JSON/CSV, import, cancellazione totale | Esporta, importa, cancella |

## Sviluppo locale

```bash
cd frontend && npm install
npm run dev        # http://localhost:5173
npm test           # test unitari (progressione, timer, dieta, recupero, cifratura)
npm run build      # build di produzione con Service Worker
```

## Cosa NON è disponibile (indicato anche in Profilo → Stato funzioni)

- **Conversione automatica foto → avatar 3D realistico.** C'è un manichino parametrico costruito dalle
  misure registrate (dichiarato come non fotorealistico) e l'import di modelli GLB/GLTF creati con un
  servizio di scansione 3D specializzato.
- **Immagini e video degli esercizi preinstallati**: si caricano foto/GIF o si collegano video.
- **Notifiche/timer garantiti con app chiusa**: i timer usano l'orario assoluto e si riallineano alla
  riapertura; le notifiche in background dipendono dal sistema operativo.
- La lettura automatica del piano alimentare è euristica e va verificata con l'originale (che resta
  sempre consultabile e non viene modificato). I `.doc` del vecchio Word si consultano ma non vengono letti.
- Il PIN protegge l'accesso all'interfaccia; l'archivio del browser non è cifrato dal PIN.
