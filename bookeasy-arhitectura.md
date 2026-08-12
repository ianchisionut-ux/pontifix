# bookeasy.ro — Arhitectură platformă de rezervări

Platformă SaaS de rezervări cu bot conversațional pe WhatsApp, Instagram și Facebook, pentru două categorii de business: saloane (barbershop, manichiură, coafor, vopsit) și spații de evenimente.

**Stack:** Next.js 15 (App Router) + TypeScript + Tailwind CSS + Prisma + PostgreSQL (Neon) + Vercel

---

## 1. Componente majore

```
Canale intrare (WhatsApp / Instagram / Facebook)
        │ webhooks Meta Graph API
        ▼
API Layer (Next.js Route Handlers)
        ▼
Bot Engine (state machine + NLU via Claude API)
        ▼
Booking Engine (disponibilitate, reguli, reminder-e)
        ▼
Database (Neon PostgreSQL + Prisma)
        ▼
Dashboard (Next.js, per business, NextAuth)
```

---

## 2. Cele două modele de business

| | SALON | EVENT_VENUE |
|---|---|---|
| Rezervare | slot fix (X minute), cu angajat | interval liber, blochează resursa |
| Paralelism | mai mulți clienți simultan, per angajat | de regulă un eveniment/zi/sală |
| Bot întreabă | serviciu → angajat (opțional) → oră | dată → durată → nr. invitați → avans |
| Calendar | coloane per angajat | rânduri per sală, blocuri multi-zi |

`Business.category: SALON | EVENT_VENUE` determină ramificarea UI-ului și a logicii botului în tot sistemul.

---

## 3. Schema Prisma — nucleu

Entități principale: `Business`, `User`, `Staff` (SALON), `Resource` (EVENT_VENUE), `Service`, `Customer`, `Booking`, `Conversation`, `Channel`, `WorkingHours`, `Plan`, `Subscription`.

Puncte cheie:
- `Booking.staffId` (SALON) vs `Booking.resourceId` (EVENT_VENUE) — populate exclusiv, în funcție de categorie
- `Channel` stochează token-uri criptate AES-256-GCM (pattern reutilizat din Dracula's Soil), cu `status: ACTIVE | EXPIRING_SOON | EXPIRED`
- `Conversation.state` (JSON) ține state machine-ul botului per client
- `reminder24hSent` / `reminder1hSent` pe `Booking` — evită trimiteri duplicate

---

## 4. Bot conversațional

**Flux:** IDLE → SELECTING_SERVICE → SELECTING_SLOT → COLLECTING_NAME → CONFIRMING → BOOKED

- **NLU** — Claude API (Sonnet) cu tool use pentru extracție structurată din mesaje libere în română (mai robust decât regex)
- **Anulare conversație** — interceptată global, funcționează din orice stare (`nu`, `stop`, `anulează`)
- **Timeout** — peste 24h fără activitate, conversația se resetează la IDLE cu mesaj contextual
- **Anulare rezervare confirmată** — pattern separat (`ANULEZ`), verificat înaintea state machine-ului, cu fereastră minimă de 2h înainte de programare
- **Bot pe pauză** — dacă `Channel.status !== ACTIVE`, mesajul nu poate primi răspuns automat; owner-ul e alertat prin email (deduplicat la 1h)

**Webhook unic Meta** (`/api/webhooks/meta`) — verificare semnătură HMAC, ramificare pe `WHATSAPP` / `INSTAGRAM` / `FACEBOOK` din payload, identificare business prin `phoneNumberId`/`pageId`.

---

## 5. Integrări externe

### Meta (WhatsApp / Instagram / Facebook)
- OAuth via Meta Login, scope-uri: `whatsapp_business_messaging`, `pages_messaging`, `instagram_manage_messages`
- Necesită **App Review** Meta pentru producție (1-2 săptămâni) — cont de test funcțional în paralel
- Token long-lived: 60 zile, fără refresh token → alertă automată la expirare, fără auto-renewal posibil
- Mesaje proactive (reminder-e) în afara ferestrei de 24h necesită **template-uri aprobate**, nu text liber

### Google Business Profile
- API federat (5 endpoint-uri separate: reviews, posts, locations etc.), activ și menținut în 2026
- Necesită profil verificat activ de minim 60 zile + cerere formală de acces + website asociat
- Token cu refresh token → **auto-refresh silențios** posibil, alertă doar dacă refresh-ul eșuează (revocare manuală)
- Folosit pentru sincronizare recenzii + rating în dashboard (`/dashboard/recenzii`)

### SEO
- JSON-LD `LocalBusiness`/`EventVenue` generat dinamic din date DB, pe pagina publică a fiecărui business
- Google Maps embed simplu via `place_id`, fără OAuth

---

## 6. Job-uri automate (Vercel Cron)

| Cron | Frecvență | Rol |
|---|---|---|
| `/api/cron/check-tokens` | zilnic 08:00 | verifică expirare token-uri, auto-refresh Google, alertă email |
| `/api/cron/reminders` | la 15 min | reminder 24h + 1h înainte de programare, cu fereastră de toleranță ±15 min |

---

## 7. Onboarding

Wizard în 5 pași, cu progres salvat (`Business.onboardingStep`), reluat automat de unde a rămas:

1. Date de bază (nume, categorie, telefon, oraș)
2. Program de lucru
3. Servicii (SALON) / Săli (EVENT_VENUE) — formulare diferite structural
4. Echipă (opțional, doar SALON)
5. Conectare canal (WhatsApp minim)

Restul platformei (calendar manual, CRM, statistici) rămâne funcțională chiar dacă pasul 5 e sărit sau în așteptare de aprobare Meta.

---

## 8. Facturare (Stripe)

- `Plan` (Start / Profesional / Business) + `Subscription` legate de `stripeSubscriptionId`
- Trial 30 zile gestionat nativ de Stripe (`trial_period_days`), pornit din momentul checkout-ului
- Webhook Stripe sincronizează status (`TRIALING`, `ACTIVE`, `PAST_DUE`, `CANCELED`)
- Enforcement limite (`maxBookingsPerMonth`) verificat înainte de confirmarea unei rezervări prin bot

**Structură preț recomandată:** pe rezervări/lună + canale, nu pe conversații — metrică înțeleasă de owner și corelată cu costul variabil real (Claude API + WhatsApp Business messaging).

---

## 9. Identitate — bookeasy.ro

Logo: calendar + checkmark verde, navy (#0c2c53) + verde (#639922). Variantă simplificată ("mark", fără grid complet) recomandată pentru favicon și poze de profil, logo complet pentru site și materiale.

---

## 10. Ce mai rămâne de aprofundat

- Contor de mesaje nepreluate în dashboard (vizibilitate agregată pentru owner)
- Reprogramare rezervare (diferit de anulare simplă)
- API access pentru planul Business
- Multi-locație (mai multe `Business` sub același cont de owner)
