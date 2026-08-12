# Activare Google Calendar

1. În Google Cloud Console activează **Google Calendar API** pentru proiectul OAuth folosit de BookEasy.
2. În OAuth consent screen adaugă scope-ul `https://www.googleapis.com/auth/calendar` și utilizatorii de test cât timp aplicația este în Testing.
3. În clientul OAuth de tip Web application adaugă redirect URI-ul exact:
   `https://bookeasy.ro/api/google-calendar/callback`
4. În Vercel păstrează `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL`, `AUTH_SECRET` și `ENCRYPTION_KEY` pentru Production și Preview.
5. La deploy, migrarea Prisma trebuie aplicată înaintea folosirii funcției: `npx prisma migrate deploy`.
6. În BookEasy: **Medici → medic → Google Calendar → Conectează contul Google**.

BookEasy creează un calendar separat pentru medic. Sincronizarea este într-un singur sens; modificările făcute manual în Google nu sunt importate în BookEasy. Pentru clinici, datele pacientului sunt ascunse implicit.
