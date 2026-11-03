# Modulo di contatto: info@sarashanti.com → Gmail

Come funziona:

```
Visitatore → modulo sul sito → Worker Cloudflare → Resend → info@sarashanti.com → Cloudflare Email Routing → Gmail
```

- **Cloudflare Email Routing** (gratis) riceve le mail destinate a `info@sarashanti.com` e le inoltra alla tua Gmail.
- **Resend** (gratis fino a 100 mail al giorno / 3.000 al mese) invia la mail generata dal modulo.
- Il **Worker** (gratis) sta in mezzo: tiene segreta la chiave di Resend, controlla i dati e blocca lo spam semplice.
- La mail ha «Rispondi a» = indirizzo del visitatore: in Gmail basta premere **Rispondi**.

Ordine consigliato: **Parte 1 → 2 → 3 → 4**. La parte 5 è facoltativa.

---

## Parte 1 — Ricevere `info@sarashanti.com` su Gmail (Cloudflare Email Routing)

1. Entra su https://dash.cloudflare.com e scegli il dominio **sarashanti.com**.
2. Nel menu a sinistra: **Email → Email Routing**. Premi **Get started** (o *Enable Email Routing*).
3. **Custom address**: scrivi `info`, azione **Send to an email**, destinazione = la tua Gmail. Salva.
4. Cloudflare invia alla Gmail una mail di verifica: apri il link di conferma.
5. Quando richiesto, premi **Add records and enable**: Cloudflare aggiunge da solo i record DNS (3 MX e un TXT SPF).
   Se il dominio aveva già altri record MX (ad es. di un altro servizio di posta), Cloudflare ti chiede di toglierli: confermi.
6. **Prova**: da un altro indirizzo scrivi a `info@sarashanti.com`. Deve arrivare in Gmail (controlla anche Spam la prima volta).

> I record DNS di GitHub Pages (A / CNAME) restano com'erano: non c'entrano con la posta.

---

## Parte 2 — Resend (invio delle mail)

1. Crea l'account su https://resend.com (gratis).
2. **Domains → Add Domain** → scrivi `sarashanti.com`. Come regione scegli quella europea (Ireland) per i dati dei visitatori.
3. Resend mostra 3 record DNS (un MX e un TXT SPF sul nome `send`, un TXT DKIM sul nome `resend._domainkey`).
   Due modi per inserirli:
   - **Automatico**: premi **Sign in to Cloudflare** e autorizza. Resend li aggiunge da solo.
   - **Manuale**: Cloudflare → **DNS → Records → Add record**, uno per uno. Nel campo *Name* incolla solo `send` o `resend._domainkey` (senza `.sarashanti.com`). Per l'MX usa priorità 10 (se è occupata, 11 o 12). Tutti i record devono essere **DNS only** (nuvola grigia).
4. Premi **Verify DNS Records** su Resend: di solito basta qualche minuto. Aspetta lo stato **Verified**.
   Questi record stanno su `send.` e `resend._domainkey.`, quindi **non entrano in conflitto** con i record della Parte 1.
5. **API Keys → Create API Key**: nome `sito-sarashanti`, permesso **Sending access**, dominio `sarashanti.com`. Copia la chiave (inizia con `re_…`): si vede una volta sola.

---

## Parte 3 — Pubblicare il Worker su Cloudflare

Serve Node.js installato. In questa cartella (`contact/`):

1. `npm install`
2. `npx wrangler login` (si apre il browser, autorizzi)
3. Controlla `wrangler.toml`: `ALLOWED_ORIGINS`, `TO_EMAIL` e `FROM_EMAIL` sono già impostati per `sarashanti.com`.
   Se vuoi provare il modulo prima che il dominio sia attivo, aggiungi in `ALLOWED_ORIGINS` anche `https://NOMEUTENTE.github.io`.
4. Salva la chiave di Resend come segreto: `npx wrangler secret put RESEND_API_KEY` (incolla la chiave `re_…`).
5. `npx wrangler deploy` → stampa l'indirizzo, tipo `https://sara-contact.NOME.workers.dev`. **Copialo.**

*(Facoltativo)* indirizzo più ordinato `https://contact.sarashanti.com`: in `wrangler.toml` togli il `#` dalle righe `[[routes]]`, poi `npx wrangler deploy`.

---

## Parte 4 — Collegare il sito

1. Apri la dashboard del sito → **Contatti e informazioni**.
2. In **Indirizzo del modulo di contatto** incolla l'indirizzo del Worker (senza `/send` alla fine).
3. In **Email per le prenotazioni** scrivi `info@sarashanti.com` (serve solo come alternativa se il modulo non funziona).
4. **Pubblica modifiche**. Dopo 1-2 minuti: premi «Message Sara to book», compila e invia.
   Dopo pochi secondi il messaggio deve essere in Gmail.

---

## Parte 5 (facoltativa) — Rispondere da Gmail come `info@sarashanti.com`

Così, rispondendo a un cliente, il mittente è `info@sarashanti.com` e non la tua Gmail personale.

1. Su Resend crea una **seconda** API key (Sending access, dominio `sarashanti.com`), nome `gmail-send-as`.
2. Gmail → ⚙ **Visualizza tutte le impostazioni → Account e importazione → Invia messaggio come → Aggiungi un altro indirizzo email**.
3. Nome: *Sara Shanti Yoga*, indirizzo: `info@sarashanti.com`.
4. Server SMTP: `smtp.resend.com`, porta `465`, connessione protetta SSL. Nome utente: `resend`. Password: la chiave `re_…` appena creata.
5. Gmail manda un codice di conferma a `info@sarashanti.com`: grazie alla Parte 1 arriva nella stessa Gmail. Inseriscilo.

---

## Altre mail con Resend

Per mail automatiche (ad esempio una conferma al visitatore) si riusa lo stesso dominio e la stessa chiave: basta una seconda chiamata a `https://api.resend.com/emails` nel Worker. Non è attiva di proposito: un modulo pubblico che scrive a indirizzi scelti dai visitatori può essere sfruttato per spam. Se la vuoi, conviene aggiungere prima Cloudflare Turnstile (gratis).

## Se qualcosa non va

- **Il modulo dice «something went wrong»**: Cloudflare → Workers & Pages → `sara-contact` → **Logs**. Un errore `403` da Resend/dominio = dominio non ancora *Verified* o `FROM_EMAIL` su un altro dominio; `401` = chiave sbagliata (ripeti il passo 4 della Parte 3).
- **Errore di origine (403) nel browser**: l'indirizzo del sito non è in `ALLOWED_ORIGINS` (controlla `www` sì/no) → modifica e rilancia `npx wrangler deploy`.
- **La mail parte ma non arriva in Gmail**: guarda Spam; controlla in Cloudflare che Email Routing sia *Enabled* e l'indirizzo `info` attivo.
- **Anti-spam**: un campo nascosto e un tempo minimo di compilazione scartano la maggior parte dei bot; se un giorno arrivano molti messaggi indesiderati, aggiungi Turnstile o una regola di *rate limiting* su Cloudflare.


## Importante — attivazione effettiva dell'invio automatico

Il modulo grafico è già presente nel sito. Per far arrivare gli invii direttamente a `info@sarashanti.com` senza dipendere dal programma di posta del visitatore, è necessario pubblicare il Worker (Parte 3) e configurare il suo URL nella dashboard:

1. Dopo `npx wrangler deploy`, copia l'URL `https://...workers.dev` restituito da Cloudflare.
2. Apri `admin/` sul sito, entra in **Contatti e informazioni** e incolla l'URL in **Indirizzo del modulo di contatto** (senza `/send`).
3. Verifica che **Email per le prenotazioni** sia `info@sarashanti.com`, quindi pubblica le modifiche.
4. Fai un invio di prova dal sito e verifica che arrivi a `info@sarashanti.com`.

Finché il Worker non è configurato, il modulo si apre comunque e prepara una mail indirizzata a `info@sarashanti.com` nell'applicazione di posta del visitatore. L'invio automatico dal sito si attiva appena viene configurato l'URL del Worker.
