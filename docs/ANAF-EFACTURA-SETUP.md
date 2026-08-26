# Configurare RO e-Factura / SPV

Integrarea pornește implicit în mediul ANAF de test și nu transmite automat documente.

Variabile necesare în Vercel:

- `ANAF_CLIENT_ID`
- `ANAF_CLIENT_SECRET`
- `ANAF_REDIRECT_URI=https://elmontz.vercel.app/api/accounting/efactura/callback`
- `ANAF_ENVIRONMENT=test` (schimbat în `production` numai după validarea fluxului)
- `ENCRYPTION_KEY` (deja folosit de aplicație; este utilizat și pentru tokenurile OAuth ANAF)

În aplicația înregistrată la ANAF, URI-ul de callback trebuie să fie identic cu `ANAF_REDIRECT_URI`.

După configurare, superadminul deschide Facturare > e-Factura, conectează certificatul/SPV, apoi testează în ordine: validare XML, descărcare XML, trimitere, verificare status și sincronizare mesaje.