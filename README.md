# bookeasy.ro

Platformă de rezervări cu bot conversațional pe WhatsApp, Instagram și Facebook, pentru saloane (frizerie, manichiură, coafor) și spații de evenimente.

Vezi `bookeasy-arhitectura.md` pentru documentul complet de arhitectură.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Prisma · PostgreSQL (Neon) · Vercel · Stripe · Resend · Meta Graph API · Claude API

## Setup local

```bash
npm install
cp .env.example .env
# completează .env cu valorile tale (DB, Meta, Google, Stripe, Anthropic, Resend)

npx prisma generate
npx prisma migrate dev --name init

npm run dev
```

## Structură proiect

```
app/
  dashboard/          → calendar, clienți, servicii, statistici, canale (UI protejat)
  onboarding/          → wizard 5 pași pentru businessuri noi
  api/
    webhooks/meta/      → primire mesaje WhatsApp/Instagram/Facebook
    webhooks/stripe/    → sincronizare abonamente
    oauth/[provider]/   → conectare Meta / Google Business Profile
    cron/               → verificare token-uri + reminder-e programări
    onboarding/         → salvare progresivă wizard
    subscription/       → creare checkout Stripe
lib/
  bot-engine.ts          → punctul de intrare pentru mesaje primite
  conversation-state-machine.ts → logica de conversație a botului
  nlu.ts                 → extracție intenție via Claude API
  availability.ts        → calcul sloturi libere (staff / resurse)
  channel-senders.ts      → trimitere mesaje pe fiecare canal
  crypto.ts               → criptare AES-256-GCM pentru token-uri
  email.ts                → alerte prin Resend
  auth.ts                 → NextAuth (credentials, JWT)
prisma/
  schema.prisma            → schema completă a bazei de date
```

## Ce mai trebuie făcut înainte de producție

- [ ] Meta App Review (whatsapp_business_messaging, pages_messaging, instagram_manage_messages)
- [ ] Verificare Google Business Profile (activ 60+ zile) + cerere acces API
- [ ] Template-uri WhatsApp aprobate pentru reminder-e (mesaje proactive)
- [ ] Configurare Stripe products/prices pentru fiecare `Plan`
- [ ] Populare `Plan` în DB cu `stripePriceId` reale
- [ ] Configurare cron extern (cron-job.org) pentru `/api/cron/reminders` (Vercel Hobby permite doar cron zilnic)
- [x] Pagini `/login`, `/signup`, `/onboarding/step-1..5` — implementate, flux complet funcțional
- [x] Ruta NextAuth (`/api/auth/[...nextauth]`) — era lipsă, adăugată
- [ ] Middleware suplimentar de protecție pe `/api/*` sensibile (în afară de verificările din fiecare rută)
