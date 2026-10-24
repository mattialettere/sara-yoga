# Sara Shanti Yoga — sito con area amministratore (GitHub Pages)

Sito statico con **dashboard** (`/admin/`) per modificare testi e foto senza toccare il codice, e un **contatore visite** opzionale. Funziona interamente su **GitHub Pages**: nessun PHP, nessun server da gestire.

## Come funziona
- Il sito è `index.html`, generato dalla dashboard a partire da `content.json`.
- Quando l'amministratrice preme **«Pubblica modifiche»**, la dashboard crea un commit sul repository (testi, pagina e foto nuove insieme); GitHub Pages aggiorna il sito in 1-2 minuti.
- Le foto vengono ridimensionate (max 1800 px) direttamente nel browser prima di essere caricate.
- Ogni pubblicazione resta nella cronologia di GitHub: da *Account e versioni* si può ricaricare una versione precedente.

## Messa online (una volta sola)
1. Carica il contenuto di questa cartella in un repository GitHub (la cartella `sara-yoga-main` è la radice del repository).
2. Repository → **Settings → Pages** → *Deploy from a branch* → ramo `main`, cartella `/ (root)`.
3. Il sito sarà su `https://NOMEUTENTE.github.io/NOME-REPO/` e la dashboard su `…/admin/`.
4. Crea un **token GitHub** per la dashboard: *Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token*. In «Repository access» scegli **solo questo repository**; in «Permissions → Repository permissions» imposta **Contents: Read and write**.
5. Apri la dashboard, entra, vai su **Collegamenti**, inserisci utente GitHub, nome del repository e il token. Il token resta **solo in quel browser**, cifrato con la password; su un altro browser/dispositivo va inserito di nuovo.

## Accesso alla dashboard
Credenziali di prova: **admin@prova.it** / **1234**.
Prima di pubblicare, cambiale da *Account e versioni*.

> **Nota di sicurezza:** su GitHub Pages l'accesso con email e password è controllato nel browser, quindi serve a evitare modifiche per errore, non a proteggere il sito da un attaccante. La vera protezione è il **token GitHub**, che solo chi lo possiede può usare per pubblicare. Non condividere il token e usa una password robusta.

## Cosa si può modificare
Tutte le sezioni: contatti e indirizzo, logo e menu, copertina, introduzione, chi sono, la lezione, galleria (foto aggiungibili/spostabili/eliminabili), frase in evidenza, date e luogo, prezzi, FAQ, curiosità, chiusura, fondo pagina e testi per Google. In ogni sezione «Ripristina i testi originali» riporta il contenuto iniziale.
- Titoli: Invio = a capo; il pulsante «Corsivo» (o `*parole*`) mette il corsivo colorato.
- Paragrafi: una riga vuota separa un paragrafo dall'altro.

## Contatore visite (opzionale)
GitHub Pages non può contare le visite da solo: serve un piccolo servizio gratuito su Cloudflare, descritto in **`worker/README.md`** (~10 minuti, nessun IP salvato). Poi:
1. Dashboard → *Contatti e informazioni* → incolla l'indirizzo in «Indirizzo del contatore visite» → pubblica.
2. Dashboard → *Collegamenti* → inserisci la chiave del contatore.

Statistiche disponibili: visitatori unici, pagine viste, andamento giornaliero, provenienza (Google, Instagram, accesso diretto…), paesi e città, pagine, dispositivi. Le visite fatte dal browser in cui sei collegata alla dashboard non vengono contate.

## Prima di pubblicare
1. *Contatti e informazioni*: email per le prenotazioni, link al modulo di iscrizione e «Indirizzo del sito» (dominio finale).
2. Cambia email e password di accesso.
3. Conferma date, foto e permessi d'uso delle immagini.
4. **Privacy:** il contatore usa un identificativo anonimo salvato nel browser del visitatore: aggiungi un'informativa privacy (e, se richiesto, un banner cookie).
5. Se usi un dominio personalizzato, aggiungi anche quell'indirizzo in `ALLOWED_ORIGINS` del contatore (vedi `worker/wrangler.toml`).
6. Collega Google Search Console e invia `/sitemap.xml`.

## File
- `index.html`, `styles.css`, `script.js` — il sito
- `content.json` — testi e foto salvati dalla dashboard
- `admin/` — dashboard (`index.html`, `store.js`, `admin.js`, `render.js`, `schema.json`, `auth.json`)
- `worker/` — contatore visite (Cloudflare Worker + database D1)
- `tools/build.mjs` — rigenera `index.html` da `content.json` (`node tools/build.mjs`)
- `assets/uploads/` — foto caricate dalla dashboard
- `.nojekyll` — dice a GitHub Pages di pubblicare i file così come sono

## Limiti noti
- La pubblicazione richiede connessione a internet e il token collegato in quel browser.
- Se due persone pubblicano contemporaneamente (o si modifica il repository a mano), la dashboard chiede di ricaricare la pagina.
- Giorno e orari nei dati strutturati per Google si impostano in *Contatti e informazioni*, separati dal testo mostrato sul sito.
