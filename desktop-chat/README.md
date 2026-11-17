# Chat Elmont pentru Windows

Aplicația folosește chatul existent de la `https://chat.elmont.ro/chat` într-o fereastră Windows separată. Sesiunea este păstrată local în profilul aplicației, separat de Chrome. La închiderea ferestrei, aplicația rămâne în zona de notificări și verifică mesajele la fiecare cinci secunde. La primirea unui mesaj, afișează o fereastră proprie deasupra celorlalte ferestre.

## Instalare

Rulați `Chat-Elmont-Setup-1.0.0.exe`, apoi autentificați-vă cu utilizatorul Elmont. Pornirea odată cu Windows este activată la prima rulare și poate fi schimbată din meniul iconului de lângă ceas. Pentru a opri complet programul, alegeți **Ieșire** din acel meniu.

Aplicația necesită conexiune la internet. Installerul nu este semnat digital; Windows SmartScreen poate cere confirmare la instalare.

## Dezvoltare

Din acest director: `npm install`, `npm test`, `npm run package:win`. Fișierele instalabile apar în `dist/`. La distribuire, păstrați doar installerul și/sau executabilul portabil; nu distribuiți `node_modules`.
