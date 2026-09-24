# Automatizare pentru portalul DEER

Pontifix oferă autocompletarea directă a câmpurilor și un asistent local opțional pentru încărcarea PDF-urilor.

## Autocompletarea directă a câmpurilor

Butonul **Deschide și completează DEER** transmite datele dosarului în fragmentul URL, care nu este trimis serverului DEER. Extensia Elmont citește datele local și completează formularul.

### Instalare unică în Chrome

1. Din panoul **Depunere DEER**, apasă **Descarcă extensia Chrome**.
2. Extrage arhiva ZIP într-un folder pe care nu îl vei șterge.
3. Deschide `chrome://extensions`, activează **Modul pentru dezvoltatori**.
4. Apasă **Încarcă extensia neîmpachetată** și selectează folderul extras.

După instalare, pentru fiecare dosar:

- deschide **Depunere DEER** în Pontifix;
- verifică datele și apasă **Deschide și completează DEER**;
- portalul se deschide cu numărul ATR, solicitantul, localitatea, strada, acțiunea și e-mailul completate;
- completează CAPTCHA și verifică formularul înainte de trimitere.

## Asistent local pentru încărcarea PDF-urilor

Asistentul local așteaptă ca operatorul să rezolve CAPTCHA și să apese **Mai departe**, apoi atașează PDF-urile configurate. Trimiterea finală rămâne manuală, pentru verificare.

## Prima instalare

Din folderul aplicației:

```powershell
npm install
```

Asistentul folosește Google Chrome instalat pe calculator. Dacă Chrome nu este disponibil, încearcă Microsoft Edge.

## Pregătirea unei depuneri

1. În Pontifix deschide branșamentul și apoi **Depunere DEER**.
2. Alege acțiunea și bifează documentele.
3. Apasă **Descarcă automatizarea**.
4. Deschide fișierul `deer-<număr ATR>.json` și modifică:
   - `pdfDirectory`: folderul în care se află PDF-urile;
   - `file`: numele PDF-ului corespunzător fiecărui document.

Exemplu:

```json
{
  "dossierNumber": "1234567890123",
  "applicant": "NUME BENEFICIAR",
  "locality": "Zalău",
  "street": "Strada Exemplu, nr. 10",
  "action": "completareDocumentatie",
  "actionLabel": "Completare documentație",
  "email": "elmont_zalau@yahoo.com",
  "pdfDirectory": "C:\\Dosare\\1234567890123",
  "documents": [
    { "label": "ATR", "file": "ATR.pdf" },
    { "label": "Cerere", "file": "Cerere.pdf" }
  ]
}
```

Numărul dosarului este numărul ATR de 13 cifre, fără data ATR. Adresa de e-mail este impusă de script la `elmont_zalau@yahoo.com`, indiferent de valoarea din fișier.

## Rulare

```powershell
npm run deer:assist -- --config "C:\cale\deer-1234567890123.json"
```

Fluxul este:

1. se deschide Chrome și se completează datele;
2. operatorul completează CAPTCHA și apasă **Mai departe**;
3. asistentul detectează pagina următoare și atașează PDF-urile;
4. operatorul verifică și trimite formularul manual.

Pentru a valida fișierul și existența PDF-urilor fără a deschide browserul:

```powershell
npm run deer:assist -- --config "C:\cale\deer-1234567890123.json" --validate
```

### Asocierea manuală a unui PDF

În mod normal, asistentul asociază PDF-urile după eticheta câmpului. Dacă portalul schimbă etichetele, adaugă `fieldIndex` (index de la zero):

```json
{ "label": "ATR", "file": "ATR.pdf", "fieldIndex": 0 }
```

Asistentul nu citește și nu ocolește CAPTCHA și nu face trimiterea finală fără operator.
