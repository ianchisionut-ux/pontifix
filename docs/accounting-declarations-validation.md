# Verificarea declarațiilor — 24 septembrie 2026

## Corecții

- D300 și D394 folosesc intervalul perioadei fiscale configurate (lunar, trimestrial, semestrial sau anual), nu doar ultima lună. D390 și reconcilierea e-Factura rămân lunare.
- XML D300 nu este oferit la mijlocul unei perioade ordinare. Schimbările speciale de perioadă în urma achizițiilor intracomunitare nu sunt automatizate.
- Facturile cu mai multe cote sau poziții sunt numărate o singură dată în totalul documentelor D300 și în totalul achizițiilor D394.
- Rotunjirea bazelor și TVA în XML are loc după cumularea valorilor, nu separat pentru fiecare poziție.
- CSV și PDF D390 includ livrările și achizițiile, cu tipul operațiunii. Fișele CSV/PDF indică intervalul și verificările necesare.
- D394 nu mai indică date complete când lipsesc profilul fiscal, identificarea firmei sau datele declarantului/întocmitorului.
- Pagina tratează erorile de încărcare și nu păstrează un raport vechi sub o perioadă nouă.

## Verificări automate

`npm run test:accounting-flow` testează funcțiile reale cu răspunsuri de bază de date simulate: perioade, separarea D390 lunar, documente cu mai multe poziții, rotunjire și export. Nu înlocuiește validarea XML în Soft J ANAF și nu execută tranzacții în producție.

## Limite care nu trebuie ascunse

- D394 produce XML conform structurii XSD ANAF pentru un domeniu limitat: facturi interne standard B2B, parteneri plătitori TVA, regim normal, cote 11%/21%, o singură serie anuală alocată și întocmitor persoană juridică. Necesită confirmarea explicită a domeniului de către utilizator. Persoanele fizice/neplătitorii, regimurile speciale, storno/anulările, rambursarea TVA, operațiunile externe și înregistrările manuale REF blochează întregul export, nu sunt omise. Exportul necesită și validare Soft J, semnare și depunere separată.
- D300 pentru TVA la încasare, taxare inversă, pro-rata specială și alte operațiuni neclasificate rămâne blocat până la implementarea/reconcilierea tratamentului complet.
- Regimul fiscal este configurat global, fără istoric de schimbări. Perioadele istorice care au alt regim necesită verificare separată.
- CAEN, identitatea și calitatea declarantului/întocmitorului și confirmarea profilului nu se deduc automat.

## Jurnal TVA la încasare și D394 XML

Pagina Declarații ANAF include jurnalul de control lunar al încasărilor și plăților, inclusiv facturi din luni precedente. Alocarea se face proporțional pe cote și prin diferența valorilor cumulative rotunjite, astfel încât ultima plată să nu lase diferențe artificiale de un ban. Include soldul inițial/final neexigibil și procentul deductibil al achiziției. Facturile străine/cu categorii speciale, storno, rambursările, avansurile și documentele neconcordante sunt semnalate separat. Acesta este un raport de control bazat pe regimul curent, nu o migrare a contului 4428 și nu un jurnal fiscal complet pentru schimbări istorice de regim.

`npm run test:tax-tools` testează alocarea, rotunjirea cumulativă, plățile parțiale, limitele exportului D394 și suma de control. `npm run test:d394-xsd` validează exemplele (vânzări, achiziții, perioadă fără operațiuni) cu schema ANAF publicată la 17.09.2025, păstrată în `assets/anaf/d394_20250917.xsd`. Comanda PowerShell relaxează politica de execuție numai pentru procesul testului local; nu schimbă politica sistemului. Validarea XSD nu validează existența fiscală a CUI-urilor sau toate regulile Soft J.

Schema: https://static.anaf.ro/static/10/Anaf/Declaratii_R/AplicatiiDec/d394_20250917.xml
Structură și validări: https://static.anaf.ro/static/10/Anaf/Declaratii_R/AplicatiiDec/structD394_15092025.pdf

Referințe: [D300 ANAF](https://static.anaf.ro/static/10/Anaf/Declaratii_R/300.html), [instrucțiuni OPANAF 174/2026](https://static.anaf.ro/static/10/Anaf/formulare/D300_OPANAF_174_2026.pdf), [perioada D394](https://static.anaf.ro/static/10/Iasi/material_informativ_28-02-2025.pdf).
