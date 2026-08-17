'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type Language = 'ro' | 'hu' | 'en'

const translations: Record<'hu' | 'en', Record<string, string>> = {
  hu: {
    'Completare manuală': 'Kézi kitöltés', 'Branșament: Beneficiar': 'Csatlakozás: Kedvezményezett',
    'Branșament: Telefon': 'Csatlakozás: Telefon', 'Branșament: Amplasament': 'Csatlakozás: Helyszín',
    'Branșament: Entitate / UAT': 'Csatlakozás: Hatóság / UAT', 'Branșament: NIB': 'Csatlakozás: NIB',
    'Branșament: ATR': 'Csatlakozás: ATR', 'Branșament: Tip branșament': 'Csatlakozás: Típus',
    'Branșament: Oraș': 'Csatlakozás: Város', 'Branșament: Județ': 'Csatlakozás: Megye',
    'Branșament: Strada': 'Csatlakozás: Utca', 'Branșament: Număr': 'Csatlakozás: Házszám',
    'Branșament: Obiect complet': 'Csatlakozás: Teljes tárgy', 'Proiect: Denumire': 'Projekt: Megnevezés',
    'Proiect: Beneficiar': 'Projekt: Kedvezményezett', 'Proiect: Telefon beneficiar': 'Projekt: Telefonszám',
    'Proiect: Amplasament / adresă': 'Projekt: Helyszín / cím', 'Proiect: Număr certificat': 'Projekt: Tanúsítvány száma',
    'Proiect: Data certificatului': 'Projekt: Tanúsítvány dátuma',
    'Previzualizare, completare directă pe PDF, salvare și printare.': 'Előnézet, közvetlen PDF-kitöltés, mentés és nyomtatás.',
    'Adaugă model de cerere': 'Kérelemsablon hozzáadása', 'Modele de cereri': 'Kérelemsablonok',
    'câmpuri configurate': 'beállított mező', 'Completează pe PDF': 'Kitöltés a PDF-en',
    'PDF gol': 'Üres PDF', 'Completări salvate': 'Mentett kitöltések', 'Redeschide': 'Újranyitás',
    'Nu există încă cereri completate și salvate.': 'Még nincs kitöltött és mentett kérelem.',
    'Încarcă PDF-ul gol, care va rămâne fundalul documentului.': 'Töltse fel az üres PDF-et, amely a dokumentum háttere marad.',
    'Denumirea documentului': 'A dokumentum neve', 'Adaugă': 'Hozzáadás',
    'Fără legătură - completare manuală': 'Nincs kapcsolat - kézi kitöltés', 'Fără beneficiar': 'Nincs kedvezményezett',
    'Poziționare': 'Pozicionálás', 'Câmp': 'Mező', 'Salvează': 'Mentés', 'Configurare câmp': 'Mező beállítása',
    'Selectează un câmp de pe PDF sau adaugă unul nou.': 'Válasszon ki egy mezőt a PDF-en, vagy adjon hozzá újat.',
    'Denumire': 'Megnevezés', 'Preia automat din': 'Automatikus átvétel innen', 'Pagina': 'Oldal', 'Font': 'Betűméret',
    'Text pe mai multe rânduri': 'Többsoros szöveg', 'Șterge câmpul': 'Mező törlése', 'Salvează ca model': 'Mentés sablonként',
    'Pozițiile și legăturile vor fi reutilizate la următoarele completări.': 'A pozíciók és kapcsolatok a következő kitöltéseknél újra felhasználhatók.',
    'Ai o \u00eentrebare?': 'K\u00e9rd\u00e9se van?',
    'Despre noi': 'Rólunk', 'Servicii': 'Szolgáltatások', 'Certificări': 'Tanúsítványok', 'Contact': 'Kapcsolat',
    'Portal companie': 'Vállalati portál', 'Cere ofertă': 'Ajánlatkérés', 'Solicită o ofertă': 'Ajánlatot kérek',
    'Vezi capabilitățile': 'Szolgáltatások megtekintése', 'Energie construită responsabil din 1997': 'Felelősen épített energia 1997 óta',
    'Putere pentru': 'Energia', 'proiecte reale.': 'valódi projektekhez.',
    'Proiectăm și executăm infrastructură electrică de la 0,4 la 20 kV — branșamente, rețele, posturi de transformare și instalații de protecție.': '0,4–20 kV-os villamos infrastruktúrát tervezünk és kivitelezünk — csatlakozásokat, hálózatokat, transzformátorállomásokat és védelmi rendszereket.',
    'Experiență în domeniu': 'Szakmai tapasztalat', 'kV, domeniu autorizat': 'kV engedélyezett tartomány', 'Sisteme certificate': 'Tanúsított rendszerek',
    'experiență în infrastructură': 'infrastruktúra-tapasztalat', 'proiectare și execuție': 'tervezés és kivitelezés', 'rețele și posturi de transformare': 'hálózatok és transzformátorállomások',
    'Cine suntem': 'Kik vagyunk', 'O companie construită pentru continuitate.': 'Folytonosságra épített vállalat.',
    'ELMONT S.A. este o companie românească înființată în 1997, cu sediul în Zalău, județul Sălaj. Activitatea sa principală — CAEN 4222 — acoperă construcția proiectelor utilitare pentru electricitate și telecomunicații.': 'Az ELMONT S.A. 1997-ben alapított román vállalat, székhelye Zilah, Szilágy megye. Fő tevékenysége — CAEN 4222 — villamosenergia- és távközlési közműprojektek építése.',
    'Lucrăm cu beneficiari care au nevoie de un traseu clar: analiză, proiectare, avizare, execuție și documentație finală.': 'Ügyfeleinknek világos folyamatot biztosítunk: elemzés, tervezés, engedélyezés, kivitelezés és végleges dokumentáció.',
    'Registrul Comerțului': 'Cégjegyzékszám', 'Forma juridică': 'Jogi forma', 'Societate pe acțiuni': 'Részvénytársaság', 'Stare': 'Állapot', 'Activă': 'Aktív',
    'Ce facem': 'Tevékenységünk', 'Capabilități conectate.': 'Összekapcsolt képességek.', 'Un singur partener.': 'Egyetlen partner.',
    'Competențe pentru proiecte electrice aeriene și subterane, în zona de joasă și medie tensiune.': 'Kompetencia kis- és középfeszültségű föld feletti és föld alatti villamos projektekhez.',
    'Proiectare electrică': 'Villamos tervezés', 'Execuție specializată': 'Szakszerű kivitelezés', 'Protecție și mentenanță': 'Védelem és karbantartás',
    'Calitate verificată': 'Ellenőrzött minőség', 'Standardele sunt parte din lucrare.': 'A szabványok a munka részei.',
    'Sistem certificat': 'Tanúsított rendszer', 'Managementul calității': 'Minőségirányítás', 'Management de mediu': 'Környezetirányítás', 'Sănătate și securitate': 'Munkaegészség és biztonság',
    'Cum lucrăm': 'Munkafolyamat', 'Un traseu clar până la energizare.': 'Világos út az üzembe helyezésig.', 'Analiză': 'Elemzés', 'Proiectare': 'Tervezés', 'Execuție': 'Kivitelezés', 'Predare': 'Átadás',
    'Începe proiectul': 'Projekt indítása', 'Ai un ATR?': 'Van ATR dokumentuma?', 'Ai un punct de plecare.': 'Már van kiindulópontja.',
    'ATR-ul este opțional': 'Az ATR opcionális', 'Documentul este stocat privat': 'A dokumentum privát tárolású', 'Cererea ajunge direct la echipa Elmont': 'A kérés közvetlenül az Elmont csapatához érkezik',
    'Preferi contact direct?': 'Közvetlen kapcsolatot szeretne?', 'Navigare': 'Navigáció', 'Date companie': 'Cégadatok', 'Toate drepturile rezervate.': 'Minden jog fenntartva.',
    'Termeni și condiții': 'Általános feltételek', 'Confidențialitate': 'Adatvédelem',
    'Cerere de ofertă': 'Ajánlatkérés', 'Spune-ne ce construim.': 'Mondja el, mit építünk.', 'Nume și prenume *': 'Név *', 'Telefon *': 'Telefon *', 'Localitatea lucrării': 'A munka helyszíne',
    'Tipul proiectului *': 'Projekt típusa *', 'Detalii despre proiect': 'Projekt részletei', 'Aviz tehnic de racordare - ATR': 'Műszaki csatlakozási engedély - ATR', '(opțional)': '(opcionális)',
    'Selectează sau trage aici documentul PDF': 'Válassza ki vagy húzza ide a PDF dokumentumot', 'Solicită oferta': 'Ajánlat kérése', 'Se trimite...': 'Küldés...',
    'Cererea a ajuns la noi.': 'Megkaptuk a kérelmét.', 'Analizăm datele proiectului și revenim pentru clarificări sau ofertare. ATR-ul încărcat a fost salvat în siguranță.': 'Elemezzük a projekt adatait, majd pontosítás vagy ajánlatadás céljából jelentkezünk. A feltöltött ATR dokumentumot biztonságosan tároljuk.', 'Dacă încarci ATR-ul, aplicația încearcă să completeze local numele, telefonul și adresa. Verifică întotdeauna datele înainte de trimitere.': 'Az ATR feltöltésekor az alkalmazás helyben megpróbálja kitölteni a nevet, a telefonszámot és a címet. Küldés előtt mindig ellenőrizze az adatokat.', 'Trimite o altă cerere': 'Új kérelem küldése',
    'Acces securizat': 'Biztonságos hozzáférés', 'Portalul intern': 'Belső portál', 'Autentificare': 'Bejelentkezés', 'Introdu datele contului tău Elmont.': 'Adja meg Elmont-fiókja adatait.',
    'Parolă': 'Jelszó', 'Intră în portal': 'Belépés a portálra', 'Se conectează...': 'Bejelentkezés...', 'Am uitat parola': 'Elfelejtettem a jelszót', 'Înapoi la site': 'Vissza a weboldalra',
    'Prezentare': 'Áttekintés', 'Pontaje': 'Munkaidő', 'Angajați': 'Alkalmazottak', 'Concedii': 'Szabadságok', 'Rapoarte': 'Jelentések', 'Oferte': 'Ajánlatok', 'Proiecte': 'Projektek', 'Branșamente': 'Csatlakozások', 'Formulare': 'Űrlapok', 'Mesaje': 'Üzenetek', 'Chat intern': 'Belső chat', 'Configurare': 'Beállítások', 'Cont': 'Fiók',
    'Documente tipizate': 'Szabványosított dokumentumok', 'Formulare și cereri': 'Űrlapok és kérelmek', 'Previzualizare, printare și gestiunea modelelor companiei.': 'A vállalati sablonok előnézete, nyomtatása és kezelése.', 'Adaugă formular': 'Űrlap hozzáadása', 'Cereri': 'Kérelmek', 'Modelele de cereri urmează să fie configurate': 'A kérelemsablonok konfigurálása következik', 'Pentru fiecare cerere vom stabili ce date se preiau din proiectul sau branșamentul selectat.': 'Minden kérelemnél meghatározzuk, hogy mely adatok kerüljenek át a kiválasztott projektből vagy csatlakozásból.', 'Printează': 'Nyomtatás', 'Deschide PDF': 'PDF megnyitása', 'Înlocuiește': 'Csere', 'Încarcă un model PDF tipizat.': 'Töltsön fel egy szabványos PDF-sablont.', 'Denumirea formularului': 'Az űrlap neve', 'Selectează documentul PDF': 'Válassza ki a PDF dokumentumot', 'Maximum 20 MB': 'Legfeljebb 20 MB', 'Renunță': 'Mégse', 'Fișierul trebuie să fie PDF.': 'A fájlnak PDF formátumúnak kell lennie.', 'PDF-ul poate avea maximum 20 MB.': 'A PDF legfeljebb 20 MB méretű lehet.', 'Formularul nu a putut fi adăugat.': 'Az űrlapot nem sikerült hozzáadni.', 'Formularul nu a putut fi înlocuit.': 'Az űrlapot nem sikerült lecserélni.',
    'Pontaj clar, zi de zi.': 'Átlátható munkaidő, minden nap.', 'Vizualizare grilă': 'Rácsnézet', 'Vizualizare listă': 'Listanézet',
    'Întrebări rapide': 'Gyors kérdések', 'Scrie-ne și revenim cu un răspuns.': 'Írjon nekünk, és válaszolunk.', 'Mesaj trimis': 'Üzenet elküldve', 'Echipa Elmont va reveni folosind datele de contact oferite.': 'Az Elmont csapata a megadott elérhetőségen jelentkezik.', 'Nume și prenume': 'Név', 'Telefon': 'Telefon', 'Cu ce te putem ajuta?': 'Miben segíthetünk?', 'Trimite mesajul': 'Üzenet küldése',
    'Linii electrice aeriene și subterane, posturi de transformare și partea electrică de medie tensiune.': 'Föld feletti és föld alatti villamos vezetékek, transzformátorállomások és középfeszültségű villamos rendszerek.', 'Punem în operă proiecte de infrastructură electrică, de la branșament la rețele complexe.': 'Villamos infrastrukturális projekteket valósítunk meg a csatlakozástól az összetett hálózatokig.', 'Lucrări pentru exploatarea sigură și durabilă a instalațiilor electrice.': 'Munkák a villamos berendezések biztonságos és tartós üzemeltetéséhez.',
    'Rețele 0,4–20 kV': '0,4–20 kV hálózatok', 'Posturi de transformare': 'Transzformátorállomások', 'Branșamente și racorduri': 'Csatlakozások és bekötések', 'Execuție linii electrice': 'Villamos vezetékek kivitelezése', 'Stații de medie tensiune': 'Középfeszültségű állomások', 'Lucrări conexe rețelelor': 'Kapcsolódó hálózati munkák', 'Instalații de paratrăsnet': 'Villámvédelmi rendszerek', 'Prize și rețele de pământ': 'Földelő rendszerek', 'Reparații specializate': 'Szakszerű javítások',
  },
  en: {
    'Completare manuală': 'Manual entry', 'Branșament: Beneficiar': 'Connection: Beneficiary',
    'Branșament: Telefon': 'Connection: Phone', 'Branșament: Amplasament': 'Connection: Location',
    'Branșament: Entitate / UAT': 'Connection: Authority / UAT', 'Branșament: NIB': 'Connection: NIB',
    'Branșament: ATR': 'Connection: ATR', 'Branșament: Tip branșament': 'Connection: Type',
    'Branșament: Oraș': 'Connection: City', 'Branșament: Județ': 'Connection: County',
    'Branșament: Strada': 'Connection: Street', 'Branșament: Număr': 'Connection: Number',
    'Branșament: Obiect complet': 'Connection: Full subject', 'Proiect: Denumire': 'Project: Name',
    'Proiect: Beneficiar': 'Project: Beneficiary', 'Proiect: Telefon beneficiar': 'Project: Beneficiary phone',
    'Proiect: Amplasament / adresă': 'Project: Location / address', 'Proiect: Număr certificat': 'Project: Certificate number',
    'Proiect: Data certificatului': 'Project: Certificate date',
    'Previzualizare, completare directă pe PDF, salvare și printare.': 'Preview, fill directly on the PDF, save and print.',
    'Adaugă model de cerere': 'Add request template', 'Modele de cereri': 'Request templates',
    'câmpuri configurate': 'configured fields', 'Completează pe PDF': 'Fill on PDF',
    'PDF gol': 'Blank PDF', 'Completări salvate': 'Saved entries', 'Redeschide': 'Reopen',
    'Nu există încă cereri completate și salvate.': 'There are no completed and saved requests yet.',
    'Încarcă PDF-ul gol, care va rămâne fundalul documentului.': 'Upload the blank PDF, which will remain the document background.',
    'Denumirea documentului': 'Document name', 'Adaugă': 'Add',
    'Fără legătură - completare manuală': 'No link - manual entry', 'Fără beneficiar': 'No beneficiary',
    'Poziționare': 'Position fields', 'Câmp': 'Field', 'Salvează': 'Save', 'Configurare câmp': 'Field settings',
    'Selectează un câmp de pe PDF sau adaugă unul nou.': 'Select a field on the PDF or add a new one.',
    'Denumire': 'Name', 'Preia automat din': 'Import automatically from', 'Pagina': 'Page', 'Font': 'Font size',
    'Text pe mai multe rânduri': 'Multiline text', 'Șterge câmpul': 'Delete field', 'Salvează ca model': 'Save as template',
    'Pozițiile și legăturile vor fi reutilizate la următoarele completări.': 'Positions and links will be reused for future entries.',
    'Ai o \u00eentrebare?': 'Have a question?',
    'Despre noi': 'About us', 'Servicii': 'Services', 'Certificări': 'Certifications', 'Contact': 'Contact',
    'Portal companie': 'Company portal', 'Cere ofertă': 'Request a quote', 'Solicită o ofertă': 'Request a quote', 'Vezi capabilitățile': 'View capabilities',
    'Energie construită responsabil din 1997': 'Responsibly built energy since 1997', 'Putere pentru': 'Power for', 'proiecte reale.': 'real projects.',
    'Proiectăm și executăm infrastructură electrică de la 0,4 la 20 kV — branșamente, rețele, posturi de transformare și instalații de protecție.': 'We design and build 0.4–20 kV electrical infrastructure — connections, grids, transformer stations and protection systems.',
    'Experiență în domeniu': 'Industry experience', 'kV, domeniu autorizat': 'kV authorised range', 'Sisteme certificate': 'Certified systems', 'experiență în infrastructură': 'infrastructure experience', 'proiectare și execuție': 'design and construction', 'rețele și posturi de transformare': 'grids and transformer stations',
    'Cine suntem': 'Who we are', 'O companie construită pentru continuitate.': 'A company built for continuity.',
    'ELMONT S.A. este o companie românească înființată în 1997, cu sediul în Zalău, județul Sălaj. Activitatea sa principală — CAEN 4222 — acoperă construcția proiectelor utilitare pentru electricitate și telecomunicații.': 'ELMONT S.A. is a Romanian company founded in 1997 and headquartered in Zalău, Sălaj County. Its main activity — CAEN 4222 — covers utility projects for electricity and telecommunications.',
    'Lucrăm cu beneficiari care au nevoie de un traseu clar: analiză, proiectare, avizare, execuție și documentație finală.': 'We give clients a clear path: analysis, design, permitting, construction and final documentation.',
    'Registrul Comerțului': 'Trade Register', 'Forma juridică': 'Legal form', 'Societate pe acțiuni': 'Joint-stock company', 'Stare': 'Status', 'Activă': 'Active',
    'Ce facem': 'What we do', 'Capabilități conectate.': 'Connected capabilities.', 'Un singur partener.': 'One trusted partner.', 'Competențe pentru proiecte electrice aeriene și subterane, în zona de joasă și medie tensiune.': 'Expertise for overhead and underground low- and medium-voltage electrical projects.',
    'Proiectare electrică': 'Electrical design', 'Execuție specializată': 'Specialised construction', 'Protecție și mentenanță': 'Protection and maintenance',
    'Calitate verificată': 'Verified quality', 'Standardele sunt parte din lucrare.': 'Standards are part of every project.', 'Sistem certificat': 'Certified system', 'Managementul calității': 'Quality management', 'Management de mediu': 'Environmental management', 'Sănătate și securitate': 'Health and safety',
    'Cum lucrăm': 'How we work', 'Un traseu clar până la energizare.': 'A clear path to energisation.', 'Analiză': 'Analysis', 'Proiectare': 'Design', 'Execuție': 'Construction', 'Predare': 'Handover',
    'Începe proiectul': 'Start your project', 'Ai un ATR?': 'Do you have an ATR?', 'Ai un punct de plecare.': 'You already have a starting point.', 'ATR-ul este opțional': 'ATR is optional', 'Documentul este stocat privat': 'The document is stored privately', 'Cererea ajunge direct la echipa Elmont': 'Your request goes directly to the Elmont team',
    'Preferi contact direct?': 'Prefer direct contact?', 'Navigare': 'Navigation', 'Date companie': 'Company details', 'Toate drepturile rezervate.': 'All rights reserved.', 'Termeni și condiții': 'Terms and conditions', 'Confidențialitate': 'Privacy',
    'Cerere de ofertă': 'Quote request', 'Spune-ne ce construim.': 'Tell us what we are building.', 'Nume și prenume *': 'Full name *', 'Telefon *': 'Phone *', 'Localitatea lucrării': 'Project location', 'Tipul proiectului *': 'Project type *', 'Detalii despre proiect': 'Project details', 'Aviz tehnic de racordare - ATR': 'Technical connection permit - ATR', '(opțional)': '(optional)',
    'Selectează sau trage aici documentul PDF': 'Select or drop the PDF document here', 'Solicită oferta': 'Request quote', 'Se trimite...': 'Sending...', 'Cererea a ajuns la noi.': 'We received your request.', 'Analizăm datele proiectului și revenim pentru clarificări sau ofertare. ATR-ul încărcat a fost salvat în siguranță.': 'We will review the project details and contact you for clarification or a quote. The uploaded ATR document is stored securely.', 'Dacă încarci ATR-ul, aplicația încearcă să completeze local numele, telefonul și adresa. Verifică întotdeauna datele înainte de trimitere.': 'When you upload the ATR, the application tries to fill in the name, phone number and address locally. Always check the details before submitting.', 'Trimite o altă cerere': 'Send another request',
    'Acces securizat': 'Secure access', 'Portalul intern': 'Internal portal', 'Autentificare': 'Sign in', 'Introdu datele contului tău Elmont.': 'Enter your Elmont account details.', 'Parolă': 'Password', 'Intră în portal': 'Enter portal', 'Se conectează...': 'Signing in...', 'Am uitat parola': 'Forgot password', 'Înapoi la site': 'Back to website',
    'Prezentare': 'Overview', 'Pontaje': 'Attendance', 'Angajați': 'Employees', 'Concedii': 'Leave', 'Rapoarte': 'Reports', 'Oferte': 'Quotes', 'Proiecte': 'Projects', 'Branșamente': 'Connections', 'Formulare': 'Forms', 'Mesaje': 'Messages', 'Chat intern': 'Internal chat', 'Configurare': 'Settings', 'Cont': 'Account',
    'Documente tipizate': 'Standard documents', 'Formulare și cereri': 'Forms and requests', 'Previzualizare, printare și gestiunea modelelor companiei.': 'Preview, print and manage company templates.', 'Adaugă formular': 'Add form', 'Cereri': 'Requests', 'Modelele de cereri urmează să fie configurate': 'Request templates will be configured next', 'Pentru fiecare cerere vom stabili ce date se preiau din proiectul sau branșamentul selectat.': 'For each request, we will define which data is imported from the selected project or connection.', 'Printează': 'Print', 'Deschide PDF': 'Open PDF', 'Înlocuiește': 'Replace', 'Încarcă un model PDF tipizat.': 'Upload a standard PDF template.', 'Denumirea formularului': 'Form name', 'Selectează documentul PDF': 'Select PDF document', 'Maximum 20 MB': 'Maximum 20 MB', 'Renunță': 'Cancel', 'Fișierul trebuie să fie PDF.': 'The file must be a PDF.', 'PDF-ul poate avea maximum 20 MB.': 'The PDF can be up to 20 MB.', 'Formularul nu a putut fi adăugat.': 'The form could not be added.', 'Formularul nu a putut fi înlocuit.': 'The form could not be replaced.', 'Pontaj clar, zi de zi.': 'Clear attendance, every day.', 'Vizualizare grilă': 'Grid view', 'Vizualizare listă': 'List view',
    'Întrebări rapide': 'Quick questions', 'Scrie-ne și revenim cu un răspuns.': 'Send us a message and we will get back to you.', 'Mesaj trimis': 'Message sent', 'Echipa Elmont va reveni folosind datele de contact oferite.': 'The Elmont team will contact you using the details provided.', 'Nume și prenume': 'Full name', 'Telefon': 'Phone', 'Cu ce te putem ajuta?': 'How can we help?', 'Trimite mesajul': 'Send message',
    'Linii electrice aeriene și subterane, posturi de transformare și partea electrică de medie tensiune.': 'Overhead and underground power lines, transformer stations and medium-voltage electrical systems.', 'Punem în operă proiecte de infrastructură electrică, de la branșament la rețele complexe.': 'We deliver electrical infrastructure projects, from individual connections to complex grids.', 'Lucrări pentru exploatarea sigură și durabilă a instalațiilor electrice.': 'Work supporting the safe and durable operation of electrical installations.',
    'Rețele 0,4–20 kV': '0.4–20 kV grids', 'Posturi de transformare': 'Transformer stations', 'Branșamente și racorduri': 'Connections and service lines', 'Execuție linii electrice': 'Power line construction', 'Stații de medie tensiune': 'Medium-voltage stations', 'Lucrări conexe rețelelor': 'Related grid works', 'Instalații de paratrăsnet': 'Lightning protection systems', 'Prize și rețele de pământ': 'Earthing systems', 'Reparații specializate': 'Specialised repairs',
  },
}

const LanguageContext = createContext<{ language: Language; setLanguage: (language: Language) => void; tr: (text: string) => string }>({ language: 'ro', setLanguage: () => {}, tr: (text) => text })

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('ro')
  useEffect(() => {
    const saved = localStorage.getItem('elmont-language') as Language | null
    if (saved === 'ro' || saved === 'hu' || saved === 'en') setLanguageState(saved)
  }, [])
  function setLanguage(next: Language) { setLanguageState(next); localStorage.setItem('elmont-language', next); document.documentElement.lang = next }
  useEffect(() => { document.documentElement.lang = language }, [language])
  const value = useMemo(() => ({ language, setLanguage, tr: (text: string) => language === 'ro' ? text : translations[language][text] || text }), [language])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() { return useContext(LanguageContext) }
