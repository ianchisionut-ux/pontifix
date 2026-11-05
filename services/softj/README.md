# Soft J ANAF

Serviciu privat pentru validarea XML și generarea PDF prin DUKIntegrator. Este accesat numai din ruta autentificată Next.js prin binding-ul Vercel `SOFTJ_INTERNAL_URL`. Nu semnează, nu depune și nu persistă declarații; folosește fișiere temporare șterse după fiecare cerere.

Pachetele din `vendor/` provin din paginile publice ANAF: DUKIntegrator 1.4.17.3.3, D300 11.02.2026, D390 25.06.2025, D394 17.09.2025, D112 03.11.2026. Înaintea unei actualizări, se verifică pagina oficială a fiecărei declarații și se înlocuiesc ambele JAR-uri (`Validator` și `Pdf`).

Rulare locală: `python services/softj/server.py` (necesită Java 8). `GET /health` verifică prezența JAR-urilor. `POST /render` primește `{"type":"D300","mode":"validate","xml":"..."}`; `mode: "pdf"` returnează PDF-ul validat în base64.

Sursă DUK: https://static.anaf.ro/static/DUKIntegrator/DUKIntegrator.htm

Surse validatoare: https://static.anaf.ro/static/10/Anaf/Declaratii_R/300.html , https://static.anaf.ro/static/10/Anaf/Declaratii_R/390.html , https://static.anaf.ro/static/10/Anaf/Declaratii_R/394.html , https://static.anaf.ro/static/10/Anaf/Declaratii_R/112.html
