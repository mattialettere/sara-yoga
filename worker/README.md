# Contatore visite (Cloudflare Worker)

Serve a contare visitatori unici, pagine viste e provenienza per il sito su GitHub Pages.
Gratis (piano Free di Cloudflare), non salva IP, nessuna manutenzione.

## Attivazione (una volta sola, ~10 minuti)
1. Crea un account gratuito su https://dash.cloudflare.com
2. In questa cartella: `npm install`, poi `npx wrangler login`
3. Crea il database: `npx wrangler d1 create sara-yoga-stats` → copia il `database_id` in `wrangler.toml`
4. In `wrangler.toml` sostituisci `NOMEUTENTE` con il tuo utente GitHub (o scrivi il dominio del sito)
5. Crea le tabelle: `npx wrangler d1 execute sara-yoga-stats --remote --file=schema.sql`
6. Scegli una chiave segreta lunga e salvala: `npx wrangler secret put ADMIN_KEY`
7. Pubblica: `npx wrangler deploy` → ti stampa l'indirizzo, tipo `https://sara-yoga-stats.xxx.workers.dev`
8. In dashboard → *Contatti e informazioni* incolla l'indirizzo in «Indirizzo del contatore visite»;
   in *Collegamenti* incolla la stessa chiave scelta al punto 6. Poi pubblica.

## Note
- Solo il sito indicato in `ALLOWED_ORIGINS` può inviare visite e leggere le statistiche.
- Le statistiche si leggono con la chiave `ADMIN_KEY`, che resta solo nel browser di chi amministra.
- Il piano gratuito basta per migliaia di visite al giorno.
