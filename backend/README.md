# My Fitness & Futsal — backend (opzionale)

Backend Spring Boot **opzionale** per la PWA "My Fitness & Futsal".
La PWA (cartella `../frontend`) è completamente *local-first*: funziona offline e salva tutto nel
browser. Questo servizio aggiunge solo due cose:

1. **Sincronizzazione tramite backup cifrati** — il client cifra i dati *prima* di inviarli; il server
   salva il blob così com'è (mantenendo le ultime N versioni) e lo restituisce su richiesta.
2. **Proxy verso l'API di Claude** — la chiave `ANTHROPIC_API_KEY` resta sul server e non finisce mai
   nel codice del browser.

Utente singolo: l'accesso è protetto da un unico token (`APP_TOKEN`).

## Perché è opzionale

Senza backend l'app funziona comunque: allenamenti, schede e statistiche restano sul dispositivo e si
possono esportare/importare a mano. Il backend serve solo se vuoi sincronizzare più dispositivi tramite
backup cifrati o usare l'assistente AI senza inserire la chiave API nel browser.

## Perché non gira su Vercel

Vercel ospita siti statici e funzioni serverless Node.js/Python/Go/Edge, ma **non ha un runtime Java**
né processi sempre attivi con disco persistente. Quindi:

- **frontend** (PWA statica) → **Vercel**;
- **backend** (questo progetto, container Docker) → **Render**, **Railway**, **Fly.io** o qualunque
  host Docker/VPS.

Nel frontend basta indicare l'URL del backend e il token nelle impostazioni.

## Variabili d'ambiente

| Variabile | Default | Descrizione |
|---|---|---|
| `APP_TOKEN` | *(vuoto)* | Token bearer richiesto su tutte le API tranne `GET /api/health`. Se vuoto le API protette rispondono `503`. Usa una stringa lunga e casuale (es. `openssl rand -hex 32`). |
| `ALLOWED_ORIGINS` | `*` | Origini CORS consentite, separate da virgola (sono ammessi pattern, es. `https://*.vercel.app`). In produzione indica l'URL del frontend. |
| `ANTHROPIC_API_KEY` | *(vuoto)* | Chiave API Anthropic. Se assente l'endpoint AI risponde `503`. |
| `AI_MODEL` | `claude-opus-5-5` | Modello Claude predefinito. |
| `AI_MAX_TOKENS` | `4000` | Lunghezza massima della risposta AI (token). |
| `BACKUP_MAX_VERSIONS` | `10` | Numero di versioni di backup conservate; le più vecchie vengono eliminate. |
| `MAX_UPLOAD_MB` | `150` | Dimensione massima di una richiesta (backup) in MB. |
| `PORT` | `8080` | Porta HTTP. |
| `SPRING_DATASOURCE_URL` | `jdbc:h2:file:./data/palestra` | Database. Default: H2 su file in `./data`. Per PostgreSQL: `jdbc:postgresql://host:5432/db`. |
| `SPRING_DATASOURCE_USERNAME` | `sa` | Utente del database. |
| `SPRING_DATASOURCE_PASSWORD` | *(vuoto)* | Password del database. |
| `JAVA_OPTS` | `-XX:MaxRAMPercentage=75 -XX:+UseG1GC` | Solo immagine Docker: opzioni JVM. |

Lo schema del database viene creato/aggiornato automaticamente (`ddl-auto=update`).
Con backup grandi assicurati che la JVM abbia memoria a sufficienza (indicativamente almeno 4–5 volte
la dimensione del backup più grande).

## Avvio locale

Requisiti: Java 21 e Maven 3.9.

```bash
cd backend
export APP_TOKEN=un-token-segreto
export ANTHROPIC_API_KEY=sk-ant-...      # opzionale
mvn spring-boot:run
# verifica
curl http://localhost:8080/api/health
```

Build del jar ed esecuzione dei test:

```bash
mvn -B package
java -jar target/palestra-backend.jar
```

## Docker

```bash
cd backend
docker build -t palestra-backend .
docker run -d --name palestra-backend -p 8080:8080 \
  -e APP_TOKEN=un-token-segreto \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e ALLOWED_ORIGINS=https://tuo-progetto.vercel.app \
  -v palestra-data:/app/data \
  palestra-backend
```

Il container gira come utente non root e salva il database H2 nel volume `/app/data`.

## Deploy

- **Render**: il file [`render.yaml`](render.yaml) è un *blueprint* di esempio (servizio web Docker,
  disco persistente montato su `/app/data`, segreti con `sync: false` da impostare dalla dashboard).
  Se il repository contiene anche il frontend, `rootDir: backend` indica la cartella da costruire.
- **Railway**: crea un servizio dal repository impostando la *root directory* su `backend`; Railway
  rileva il `Dockerfile`. Aggiungi un *volume* montato su `/app/data` (oppure un database PostgreSQL e
  le variabili `SPRING_DATASOURCE_*`) e imposta le variabili d'ambiente. `PORT` viene fornita da Railway.
- **Fly.io**: `fly launch` dalla cartella `backend` (usa il `Dockerfile`), poi
  `fly volumes create palestra_data`, monta il volume su `/app/data` in `fly.toml`
  (`[mounts] source="palestra_data" destination="/app/data"`) e imposta i segreti con
  `fly secrets set APP_TOKEN=... ANTHROPIC_API_KEY=...`. `internal_port` = 8080.
- **Qualsiasi host Docker/VPS**: vedi il comando `docker run` sopra; metti davanti un reverse proxy con
  HTTPS (Caddy, Nginx, Traefik).

Il backend deve essere servito in **HTTPS**: il token viaggia nell'header `Authorization`.

## API

Tutte le risposte sono JSON. Gli errori hanno la forma `{"error": "messaggio"}`.
Tutti gli endpoint tranne `GET /api/health` richiedono l'header:

```
Authorization: Bearer <APP_TOKEN>
```

Codici di errore comuni: `400` richiesta non valida, `401` token mancante/errato, `404` non trovato,
`413` richiesta troppo grande, `503` funzione non configurata sul server.

### `GET /api/health`

Nessuna autenticazione.

```json
{"status":"ok","aiEnabled":true,"tokenConfigured":true,"version":"1.0.0"}
```

### `PUT /api/backup`

Salva una nuova versione di backup ed elimina quelle oltre `BACKUP_MAX_VERSIONS`.

```json
{
  "deviceId": "telefono-di-mario",
  "createdAt": "2026-11-17T10:00:00.000Z",
  "payload": "<blob già cifrato e in base64>",
  "checksum": "sha256-opzionale"
}
```

Risposta:

```json
{"id":42,"createdAt":"2026-11-17T10:00:00.000Z","receivedAt":"2026-11-17T10:00:01.234Z","size":123456}
```

`size` è la dimensione del payload in byte. Il `payload` non può essere vuoto.

### `GET /api/backup`

Elenco dei backup (solo metadati, dal più recente):

```json
[{"id":42,"deviceId":"telefono-di-mario","createdAt":"...","receivedAt":"...","size":123456,"checksum":"..."}]
```

### `GET /api/backup/latest`

Ultimo backup completo (metadati + `payload`). `404 {"error":"Nessun backup presente"}` se non ce ne sono.

### `GET /api/backup/{id}`

Backup completo con l'id indicato, oppure `404`.

### `DELETE /api/backup`

Elimina tutti i backup: `{"deleted": 3}`.

### `POST /api/ai/chat`

```json
{
  "system": "Sei un personal trainer...",
  "messages": [
    {"role": "user", "content": "Prepara un riscaldamento per il futsal"},
    {"role": "assistant", "content": "..."},
    {"role": "user", "content": "Più breve, 10 minuti"}
  ],
  "model": "claude-opus-5-5"
}
```

- `messages` non vuoto, ruoli solo `user`/`assistant`, il primo e l'ultimo messaggio devono essere `user`;
- lunghezza totale (system + messaggi) massima 200.000 caratteri;
- `model` è opzionale (default `AI_MODEL`).

Risposta:

```json
{"text":"Ecco un riscaldamento di 10 minuti...","stopReason":"end_turn","model":"claude-opus-5-5"}
```

Se il modello declina la richiesta (`stopReason: "refusal"`), `text` contiene un messaggio in italiano
che spiega che la richiesta non può avere risposta.
Errori del servizio AI: `429` troppe richieste, `502` chiave non valida o errore dell'API, `504` servizio
non raggiungibile.

## Privacy

- Il server conserva **solo blob cifrati** dal client: non li decodifica né li ispeziona, e senza la
  chiave/passphrase (che resta sul dispositivo) non può leggerne il contenuto. Salva in chiaro solo i
  metadati tecnici (id dispositivo, date, dimensione, checksum).
- All'assistente AI viene inviato **solo il testo che l'utente sceglie di mandare** (prompt di sistema e
  messaggi della conversazione). Il server non lo registra nei log né lo salva nel database; viene
  inoltrato all'API di Anthropic e la risposta viene restituita al client.
- La chiave API Anthropic non viene mai inviata al browser né scritta nei log.
