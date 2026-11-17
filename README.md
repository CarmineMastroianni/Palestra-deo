# My Fitness & Futsal

Personal trainer digitale personale: PWA mobile-first, installabile sul telefono, in italiano.
Gestisce allenamenti in palestra con contatore manuale e timer, carichi e doppia progressione,
calcio a 5, misure corporee, foto prima/dopo, piano del nutrizionista, report PDF e un assistente
sui dati registrati.

```
frontend/   React 18 + TypeScript + Vite – PWA (IndexedDB, Service Worker, Three.js)  → Vercel
backend/    Spring Boot 3 (Java 21) – OPZIONALE: backup cifrati + proxy Claude    → Render/Railway/Fly/Docker
vercel.json configurazione di deploy del frontend
```

L'app funziona **interamente senza backend e senza account**: i dati restano sul dispositivo
(IndexedDB) e l'app funziona offline. Il backend serve solo per la sincronizzazione cifrata tra
dispositivi e per usare Claude senza inserire la chiave API nel telefono.

## Tutto modificabile dall'app (nessuna modifica al codice)

Da **Profilo** l'utente può cambiare autonomamente:

| Cosa | Dove |
|---|---|
| Età, altezza, peso iniziale, sport, ruoli, infortuni, obiettivi, periodo del programma | Dati personali e obiettivi |
| Attività di ogni giorno della settimana, scheda assegnata, durata | Programma settimanale |
| Schede: esercizi, ordine, serie, ripetizioni/secondi, recuperi, riscaldamento, cardio, protezione gambe | Schede (+ ripristino del programma originale) |
| Esercizi: nome, tipo, muscoli, note tecniche, immagine/GIF, link video, schema 3D, incremento minimo | Libreria esercizi |
| Fasi (adattamento, forza, consolidamento, transizione), date, RIR, settimane di scarico | Fasi e scarichi |
| Percentuali di progressione, soglia RIR, soglia di recupero | Progressione e recupero |
| Recuperi predefiniti, suoni, vibrazione, voce, notifiche, schermo acceso | Timer, suoni e notifiche |
| Assistente locale o Claude (server o chiave personale), modello, consensi | Assistente AI |
| Server di sincronizzazione, token, passphrase, backup automatico | Cloud e sincronizzazione |
| PIN, biometria, blocco automatico | Sicurezza |
| Colore, dimensione del testo, misure visibili | Aspetto |
| Backup cifrato, export JSON/CSV, import, cancellazione totale | Esporta, importa, cancella |

## Pubblicazione su Vercel (frontend)

1. Su vercel.com → **Add New… → Project** → importa questo repository GitHub.
2. Lascia **Root Directory** sulla radice del repository: `vercel.json` imposta già installazione, build
   (`frontend/`) e cartella di output (`frontend/dist`), le regole SPA e gli header del Service Worker.
3. Deploy. Non servono variabili d'ambiente.
4. Sul telefono apri l'URL `https://…vercel.app`:
   - **Android/Chrome**: menu ⋮ → *Installa app*;
   - **iPhone/Safari**: Condividi → *Aggiungi alla schermata Home*.

Ogni nuovo push ripubblica l'app; all'apertura compare "Nuova versione disponibile → Aggiorna".

## Backend opzionale (Spring Boot)

Vercel non esegue Java, quindi il backend va pubblicato su un servizio che supporta Docker
(es. Render con il `backend/render.yaml` incluso, Railway, Fly.io o una VPS). Dettagli in
[`backend/README.md`](backend/README.md). In breve:

1. Pubblica `backend/` come servizio Docker e imposta `APP_TOKEN` (stringa casuale lunga),
   `ALLOWED_ORIGINS` (l'URL Vercel) e, se vuoi l'AI via server, `ANTHROPIC_API_KEY`.
2. Nell'app: Profilo → Cloud e sincronizzazione → indirizzo del server, token e passphrase.
3. I dati vengono cifrati sul telefono (AES-256-GCM, PBKDF2) prima dell'invio: il server non può leggerli.

## Sviluppo locale

```bash
cd frontend && npm install
npm run dev        # http://localhost:5173
npm test           # test unitari (progressione, timer, dieta, recupero, cifratura)
npm run build      # build di produzione con Service Worker

cd backend && mvn spring-boot:run   # opzionale, http://localhost:8080
```

## Privacy

- Foto, misure e documenti della dieta restano sul dispositivo; nessun invio a servizi esterni senza
  consenso esplicito.
- L'assistente AI (se attivato) riceve solo un riepilogo testuale dei dati per cui l'utente ha dato il
  consenso; mai foto o documenti originali.
- L'OCR delle foto della dieta avviene sul telefono (Tesseract.js); al primo uso scarica il motore e la
  lingua italiana dal CDN jsDelivr, ma l'immagine non viene inviata.
- Il PIN protegge l'accesso all'interfaccia; l'archivio del browser non è cifrato dal PIN, per questo
  backup ed esportazioni cifrate sono disponibili.

## Cosa NON è disponibile (indicato anche nell'app, Profilo → Stato funzioni)

- **Conversione automatica foto → avatar 3D realistico.** L'app mostra un manichino parametrico basato
  sulle misure registrate (dichiarato come non fotorealistico) e permette di importare un modello
  GLB/GLTF creato con un servizio di scansione 3D specializzato.
- **Immagini e video degli esercizi preinstallati.** L'utente può caricare foto/GIF o collegare video.
  La dimostrazione 3D è uno schema semplificato del movimento.
- **Notifiche/timer garantiti con app chiusa.** I timer usano l'orario assoluto e si riallineano alla
  riapertura; le notifiche in background dipendono dal sistema operativo.
- La lettura automatica del piano alimentare è euristica: va verificata con l'originale, che resta
  sempre consultabile e non viene modificato. I file `.doc` (vecchio formato Word) sono consultabili ma
  non letti automaticamente: salvarli come `.docx` o PDF.
