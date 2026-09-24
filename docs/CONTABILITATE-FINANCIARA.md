# Contabilitate financiara Pontifix

Modulul `/dashboard/contabilitate/ledger` adauga registrul in partida dubla peste fluxul existent de facturare. Planul de conturi este initializat din documentul furnizat de beneficiar, cu 577 de conturi sintetice si analitice din clasele 1-9.

## Fluxuri automate

- Factura de servicii: `4111 = 704 + 4427`.
- Factura de marfuri: `4111 = 707 + 4427`, atunci cand produsul este configurat cu contul 707.
- Incasare prin banca: `5121 = 4111`.
- Incasare in numerar: `5311 = 4111`.
- Factura storno inverseaza automat sensul liniilor generate.
- Sumele in valuta sunt contate in RON folosind cursul salvat pe factura.
- Facturile si incasarile existente sunt contate idempotent la prima accesare a modulului.
- Factura de achizitie: `6xx/3xx + 4426 = 401.xxxxx`; TVA nedeductibila majoreaza cheltuiala.
- Plata furnizorului prin banca: `401.xxxxx = 5121`; in numerar: `401.xxxxx = 5311`.
- Taxarea inversa genereaza suplimentar `4426 = 4427`, cu respectarea procentului de deductibilitate.

Emiterea facturii, salvarea incasarii si articolul contabil aferent ruleaza in aceeasi tranzactie PostgreSQL. Daca articolul este dezechilibrat, contul este inactiv sau perioada este inchisa, se anuleaza intreaga operatie.

## Registre si controale

- Registru-jurnal cronologic, cu document, explicatie, sursa si liniile debit/credit.
- Balanța de verificare cu sold initial, rulaje, total sume si sold final.
- Fisa de cont (Cartea mare) cu sold progresiv.
- Plan de conturi cautabil; se pot adauga conturi analitice proprii si activa/dezactiva conturi.
- Inchidere si redeschidere lunara. O perioada inchisa nu accepta postari, corectii sau stergeri de documente contate.
- Note contabile manuale validate obligatoriu la egalitate debit-credit.

## Registrul de evidenta fiscala

Formularul de venit/cheltuiala permite cautarea partenerului dupa CUI prin serviciul ANAF. Pentru venit si cheltuiala se salveaza un instantaneu cu denumire, CUI, numar Registrul Comertului, adresa, judet, localitate, cod postal, tara, telefon, statut TVA, stare de inregistrare si marcaj de inactivitate fiscala. Datele partenerului apar si in exportul PDF REF.

## Furnizori si intrari

- Nomenclatorul de furnizori pastreaza datele fiscale si bancare, termenul implicit de plata, TVA la incasare, afilierea, avertizarea si blocarea.
- Cautarea dupa CUI foloseste acelasi serviciu ANAF ca emiterea facturilor si completeaza denumirea, adresa, registrul comertului si statutul TVA.
- La crearea furnizorului se genereaza automat contul analitic `401.xxxxx`, folosit in toate articolele si in fisa contului.
- Intrarea se opereaza pe pozitii, fiecare cu descriere, cont de cheltuiala/stoc, unitate, cantitate, pret, cota TVA si procent de deductibilitate.
- Jurnalul de cumparari si situatia furnizorilor afiseaza totalul documentelor, platile, soldul si datoriile scadente.

## Surse functionale si legale consultate

- Manualul oficial SAGA C, introducere si inventarul functional: https://manual.sagasoft.ro/sagac/topic-1-introducere.html
- Manual SAGA C, Terti: https://manual.sagasoft.ro/sagac/topic-17-terti.html
- Manual SAGA C, Intrari - lei: https://manual.sagasoft.ro/sagac/topic-29-intrari---lei.html
- Manual SAGA C, Casa-Banca-Deconturi: https://manual.sagasoft.ro/sagac/topic-45-casa-banca-deconturi.html
- Manual SAGA C, Situatii clienti-furnizori: https://manual.sagasoft.ro/sagac/topic-60-situatii-clienti---furnizori.html
- SAGA C: evidenta contabila in partida dubla, gestiune, salarizare si raportari fiscale: https://www.sagasoft.ro/saga-c.php/PubLine.php
- Legea contabilitatii nr. 82/1991, art. 20-22: registre obligatorii si balanta lunara: https://legislatie.just.ro/Public/FormaPrintabila/00000G3TGD3R68JHR6U0RHOQGOYKDBCW
- Normele privind documentele financiar-contabile: continutul Registrului-jurnal si al Cartii mari: https://legislatie.just.ro/Public/FormaPrintabila/00000G1UC5IL6TNZJ8T1ZOO2ET844CO6
- Ghidul ANAF D406 SAF-T: conturi analitice, clienti, furnizori si General Ledger: https://static.anaf.ro/static/10/Anaf/Informatii_R/SAF_T_Ghidul_D406_1712021.pdf

## Limite si etape urmatoare

Acest release livreaza nucleul contabil, registrele principale, furnizorii, jurnalul de cumparari si integrarile facturare-incasare / achizitie-plata. Nu trebuie prezentat drept inlocuitor complet SAGA pana la implementarea si validarea de catre un expert contabil a urmatoarelor module: stocuri si descarcare de gestiune, mijloace fixe si amortizare, salarii, registru-inventar, inchidere anuala, situatii financiare, import extrase bancare, D406 SAF-T complet, declaratii suplimentare si audit trail nerepudiabil. Regulile fiscale si cotele trebuie revizuite la fiecare schimbare legislativa.
