# Elmont SMS Gateway pentru Android

Aplicația trimite mesajele beneficiarilor prin SIM-ul telefonului +40 727 700 062. Telefonul comunică direct cu `https://elmont.ro/api/sms/device/jobs`, fără un furnizor SMS cloud. Necesită Android 8+, SIM cu SMS disponibile și internet.

## Instalare și asociere

1. Instalează `elmont-sms-gateway.apk` pe telefonul cu SIM-ul indicat.
2. În Android, setează acel SIM ca implicit pentru SMS.
3. Autentifică-te pe `https://sms.elmont.ro`, generează un cod de asociere și copiază-l în aplicația Android.
4. În aplicație apasă **Acordă permisiunea pentru SMS** și alege **Permite** în fereastra Android. Apoi apasă **Pornește trimiterea SMS**; acceptă și notificările dacă sunt solicitate. Notificarea permanentă indică serviciul activ.
   Dacă Android nu mai afișează fereastra de permisiune, apasă **Deschide setările permisiunilor** și activează manual **SMS** pentru Elmont SMS.
5. Exclude Elmont SMS din optimizarea bateriei. După repornirea telefonului, redeschide aplicația și pornește serviciul.

Telefonul verifică mesajele la 12 secunde. Fiecare mesaj este revendicat atomic și este oferit telefonului o singură dată. Dacă telefonul se oprește după revendicare, mesajul rămâne **Preluat de telefon** pentru verificare manuală, pentru a evita dublurile. **Trimis** înseamnă predat rețelei mobile, nu confirmare de livrare la destinatar.

Codul de asociere este afișat o singură dată în Elmont. Un cod nou îl invalidează pe cel vechi. Cheia de semnare a APK-ului rămâne locală în `.local/` și este necesară pentru actualizările viitoare ale aplicației.
