# Enduro One 2027 🏁

Persönliche Trainings-App für die Enduro-One-Saison 2027 (Schulenberg 25.–28.6., Roßbach 4.–5.9.).
Die App ist eine PWA: Sie lässt sich auf iPhone und iPad wie eine native App installieren, ist für Mobilgeräte gebaut, läuft im Dark Mode und auf Deutsch.

**Stack:** Next.js 16 (App Router, TypeScript), Tailwind CSS 4, Supabase (Postgres + Auth), Vercel.

## Stand der Etappen

| Etappe | Inhalt | Status |
|---|---|---|
| 1 | Grundgerüst, Login, Plan, Kalender, ICS-Feed, Einstellungen, PWA | ✅ |
| 2 | Strava-Anbindung (OAuth, Import, Webhook, Zuordnung) | ✅ |
| 3 | Dashboard mit Kennzahlen und Charts | ✅ |
| 4 | Erfolge | ✅ |
| 5 | Berichte (Wochen- und Phasenreview per Cron) | ✅ |

---

## Einrichtung Schritt für Schritt (ohne Mac, alles im Browser)

Du brauchst drei kostenlose Konten: **GitHub** (hast du schon), **Supabase** und **Vercel**.
Melde dich bei Supabase und Vercel am einfachsten mit „Continue with GitHub“ an.

### Schritt 1 – Supabase-Projekt anlegen

1. Gehe zu <https://supabase.com/dashboard> und klicke auf **New project**.
2. Wähle einen Namen (z. B. `enduro-one-2027`) und als Region **Central EU (Frankfurt)**.
3. Lege ein Datenbank-Passwort fest. Speichere es in deinem Passwort-Manager, die App selbst braucht es nicht.
4. Warte etwa 2 Minuten, bis das Projekt bereit ist.

### Schritt 2 – Datenbank einrichten

1. Öffne links das Menü **SQL Editor** und klicke auf **New query**.
2. Öffne hier im GitHub-Repo die Datei [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) und klicke auf das Kopier-Symbol („Copy raw file“).
3. Füge den Inhalt im SQL Editor ein und klicke auf **Run**. Es sollte „Success. No rows returned“ erscheinen.
4. Mache dasselbe mit [`supabase/seed.sql`](supabase/seed.sql). Damit landen Rennen, Phasen, Entlastungswochen, Standardwoche und Ausnahmen in der Datenbank.
5. Außerdem [`supabase/migrations/0002_strava.sql`](supabase/migrations/0002_strava.sql) (Strava) [`supabase/migrations/0003_reports.sql`](supabase/migrations/0003_reports.sql) (Berichte) und [`supabase/migrations/0004_session_changes.sql`](supabase/migrations/0004_session_changes.sql) (Einheiten ändern) ausführen – in dieser Reihenfolge.

Beide Skripte kannst du gefahrlos mehrfach ausführen.

### Schritt 3 – Login einrichten (nur du darfst rein)

Die App nutzt **E-Mail + Passwort**. Es werden keine Mails verschickt, du brauchst also **kein SMTP** und musst keine E-Mail-Vorlagen anpassen.

1. **Registrierung abschalten:** Gehe zu **Authentication → Sign In / Providers**. Schalte **Allow new users to sign up** aus. **Email** bleibt aktiviert.
2. **Deinen Nutzer anlegen:** Gehe zu **Authentication → Users → Add user → Create new user**.
   - Trage deine E-Mail-Adresse und ein **sicheres Passwort** ein. Mit diesem Passwort meldest du dich später in der App an, also im Passwort-Manager speichern.
   - Setze den Haken bei **Auto Confirm User**.
   - Hast du den Nutzer schon ohne bekanntes Passwort angelegt? Dann lösche ihn über die drei Punkte → **Delete user** und lege ihn neu an.

> Die Sitzung bleibt auf iPhone und iPad lange bestehen. Du musst dich also nur selten neu anmelden.

### Schritt 4 – Schlüssel notieren

Unter **Project Settings** findest du drei Werte, die du gleich in Vercel einträgst:

| Wert | Wo in Supabase |
|---|---|
| Project URL | **Project Settings → Data API** (oder Projekt-Übersicht → „Connect“) |
| Publishable key (`sb_publishable_…`) | **Project Settings → API Keys** |
| Secret key (`sb_secret_…`) | **Project Settings → API Keys** → „Reveal“. **Geheim halten!** |

Ältere Projekte zeigen stattdessen `anon` und `service_role` an. Diese funktionieren genauso.

### Schritt 5 – Auf Vercel deployen

1. Öffne <https://vercel.com/new> und importiere das GitHub-Repo `CodeFux94/Main`. Falls Vercel keinen Zugriff hat, klicke auf „Adjust GitHub App Permissions“ und gib das Repo frei.
2. Vercel erkennt **Next.js** automatisch. Lass Build-Einstellungen und Root Directory unverändert.
3. Klappe **Environment Variables** auf und lege vier Variablen an (siehe [`.env.example`](.env.example)). Für jede Variable wählst du einen **Type** und füllst **Key** und **Value** aus:

   | Type | Key | Value |
   |---|---|---|
   | Config | `NEXT_PUBLIC_SUPABASE_URL` | Project URL, z. B. `https://abcd1234.supabase.co` |
   | Config | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (`sb_publishable_…`) |
   | **Secret** | `SUPABASE_SECRET_KEY` | Secret key (`sb_secret_…`) |
   | Config | `ALLOWED_EMAIL` | deine E-Mail-Adresse (dieselbe wie in Schritt 3) |

   Worauf du achten solltest:
   - Den Key exakt so schreiben, wie er oben steht.
   - Den Value ohne Anführungszeichen und ohne Leerzeichen eintragen.
   - Falls Vercel nach den Umgebungen fragt: **Production** und **Preview** auswählen.
   - Was der Type bedeutet: Bei **Secret** lässt sich der Wert später im Dashboard nicht mehr anzeigen. Bei **Config** bleibt er sichtbar. Die `NEXT_PUBLIC_…`-Werte sind ohnehin im Browser sichtbar, darum reicht dort Config.

4. Klicke auf **Deploy**. Nach etwa einer Minute bekommst du eine Adresse wie `https://enduro-one-2027.vercel.app`.

   Hast du die Variablen erst nach dem ersten Deploy eingetragen oder später geändert? Dann musst du neu deployen, denn Änderungen gelten nur für neue Deployments: **Deployments** → beim obersten Eintrag **⋯** → **Redeploy**.

**Automatisches Deployment:** Vercel ist jetzt mit dem Repo verbunden.
- Jeder Push auf `main` geht automatisch live.
- Jeder Pull Request bekommt eine eigene Vorschau-URL. Damit die Vorschau funktioniert, müssen die Variablen auch für **Preview** gesetzt sein. Das ist standardmäßig der Fall.
- Prüfen kannst du das unter **Project → Settings → Git**: Dort muss die Production Branch `main` sein.

### Schritt 6 – Erster Start

1. Öffne die Vercel-Adresse und melde dich mit E-Mail und Passwort aus Schritt 3 an.
2. Öffne **Kalender → Plan erzeugen**. Die App legt alle Einheiten vom 16.11.2026 bis zum letzten Rennen an.

### Schritt 7 – Auf iPhone/iPad installieren

1. Öffne die Adresse in **Safari**.
2. Tippe auf **Teilen** (Quadrat mit Pfeil) und dann auf **Zum Home-Bildschirm**.
3. Die App startet jetzt im Vollbild mit eigenem Icon.

### Schritt 8 – Plan im Apple Kalender abonnieren

1. In der App: **Kalender** (ganz unten) oder **Einstellungen → Im Apple Kalender abonnieren → Abonnieren**.
2. iOS fragt nach, ob du den Kalender abonnieren willst. Bestätige das.

Der Kalender aktualisiert sich danach von selbst, auch wenn du Einheiten verschiebst. Wie oft, legst du in iOS fest unter **Einstellungen → Kalender → Accounts → Abonnierte Kalender**.

Der Link enthält einen geheimen Schlüssel. Wenn er in falsche Hände gerät, erzeugst du in den Einstellungen einen neuen Link.

---

### Schritt 9 – Strava verbinden (Etappe 2)

1. **Datenbank erweitern:** Führe im Supabase **SQL Editor** die Datei [`supabase/migrations/0002_strava.sql`](supabase/migrations/0002_strava.sql) aus.
2. **Strava-API-App** anlegen unter <https://www.strava.com/settings/api>:
   - **Category:** Training
   - **Website:** deine App-Adresse, z. B. `https://main-spv8.vercel.app`
   - **Authorization Callback Domain:** nur der Domainname, z. B. `main-spv8.vercel.app`, ohne `https://`
3. **Variablen in Vercel** eintragen (Settings → Environment Variables, Production):

   | Type | Key | Value |
   |---|---|---|
   | Config | `STRAVA_CLIENT_ID` | „Client ID“ von der Strava-Seite |
   | **Secret** | `STRAVA_CLIENT_SECRET` | „Client Secret“ von der Strava-Seite |
   | **Secret** | `STRAVA_WEBHOOK_VERIFY_TOKEN` | ein frei gewähltes, langes Fantasiewort |
   | **Secret** | `CRON_SECRET` | ein anderes, frei gewähltes, langes Fantasiewort |

   Danach muss die App neu deployt werden. Das geschieht automatisch beim nächsten Merge auf `main`.
4. **In der App:** **Einstellungen → Mit Strava verbinden** → bei Strava **Zulassen** tippen.
   - Am einfachsten im normalen Browser (Safari/Chrome) verbinden, nicht in der installierten App. Die Verbindung gilt danach überall.
   - Der Import aller Aktivitäten ab 01.06.2026 startet automatisch.
5. **Webhook aktivieren:** Unter Einstellungen → Strava auf **Webhook aktivieren** tippen. Ab dann kommen neue, geänderte und gelöschte Aktivitäten automatisch in die App.

**So funktioniert der Abgleich**
- **Erstimport:** Seitenweise werden je 100 Aktivitäten geladen, danach für jede Aktivität mit Herzfrequenz einmal der HF-Verlauf (für die Zeit in den Zonen).
- **Rate-Limits:** Strava erlaubt etwa 100 Lese-Anfragen pro 15 Minuten und 1.000 pro Tag. Kurz vor dem Limit stoppt die App und speichert den Fortschritt. Der Rest folgt beim nächsten **Jetzt abgleichen** (nach 15 Minuten) oder automatisch beim täglichen Abgleich (ca. 7:47 Uhr).
- **HF-Zonen:** Die App speichert pro Aktivität eine Herzfrequenz-Verteilung. Änderst du die Zonen in den Einstellungen, wird alles neu berechnet, ohne Strava erneut abzufragen.
- **Zuordnung zu Einheiten:**

  | Einheit | passende Strava-Typen |
  |---|---|
  | Kraft | WeightTraining, Workout, Crossfit |
  | Yoga & Mobility | Yoga, Pilates |
  | Enduro | MountainBikeRide, EMountainBikeRide |
  | Gravel | GravelRide, Ride (notfalls MTB) |
  | Ausdauer (Studio/Lauf) | Run, VirtualRun, Elliptical, StairStepper, Rowing (auch VirtualRide, Workout, Walk) |
  | Intervalle | VirtualRide (Indoor), Lauf (Run, TrailRun, VirtualRun – Laufband oder draußen) oder Fahrt mit mindestens 5 Minuten in Z4/Z5 |
  | Rennen | jede Radfahrt |

  Status: **erledigt** (Aktivität am Plantag), **verschoben** (bis 2 Tage daneben, gleiche Woche), **verpasst** (Tag vorbei, keine Aktivität). Nicht zugeordnete Aktivitäten erscheinen im Kalender als „zusätzlich“.
- **Statusseite:** `/api/health` zeigt, ob alle Variablen gesetzt sind (nur ja/nein, nie die Werte).

### Schritt 10 – Berichte (Etappe 5)

1. Im Supabase **SQL Editor** [`supabase/migrations/0003_reports.sql`](supabase/migrations/0003_reports.sql) ausführen.
2. Fertig – `CRON_SECRET` ist aus Schritt 9 schon gesetzt.

**So funktioniert es**
- **Wochenreview:** Jeden **Montag ca. 6:23 Uhr** holt die App die neuesten Strava-Daten und speichert das Review der Vorwoche. Inhalt:
  - Soll/Ist je Einheit
  - Umfang, Höhenmeter, Belastung
  - Intensitätsverteilung
  - Vergleich zur Vorwoche
  - neue Bestwerte und Badges
  - „Was war gut“ und „Wo steckt Potenzial“
- **Phasenbericht:** Am Tag nach dem Ende einer Phase entsteht die Bilanz der ganzen Phase, mit Ausblick auf die nächste.
- **Täglicher Abgleich (ca. 7:47 Uhr):** Holt verpasste Berichte nach, z. B. wenn ein Montag ausgefallen ist.
- **Archiv:** Gespeicherte Berichte bleiben unverändert. Mit **Neu berechnen** lässt sich ein Bericht mit den aktuellen Daten überschreiben, z. B. wenn eine Aktivität nachträglich hochgeladen wurde.
- **Vorschau:** Unter Berichte → **Laufende Woche** bzw. **Laufende Phase** siehst du jederzeit den aktuellen Zwischenstand.

**Regeln für „Was war gut“ / „Wo steckt Potenzial“** (in `lib/reports/build.ts`, alle Schwellen dort anpassbar):

| Gut | Potenzial |
|---|---|
| alle bzw. ≥ 80 % der Einheiten erledigt | verpasste Einheiten (Kraft und Mobility mit eigenem Hinweis) |
| Umfang im Soll-Bereich | Umfang unter Soll bzw. deutlich darüber (Entlastungswoche!) |
| Entlastungswoche eingehalten | Belastung > 30 % über der Vorwoche |
| ≥ 75 % locker (Z1–Z2) | < 75 % locker in Trainingsphasen; ≥ 25 % in Z3 („graue Zone“) |
| ≥ 10 min in Z4–Z5 bei Intervallen | Intervalle ohne echte Intensität |
| ≥ 1.500 hm und mehr als in der Vorwoche | ≥ 2 Einheiten verschoben |
| neue Bestwerte, Badges, Serie ≥ 2 Wochen | gleicher Wochentag fällt in 4 Wochen mehrfach aus |

---

## Die App benutzen

- **Kalender:** Monatsansicht mit farbigen Phasen, hervorgehobenen Rennen und Punkten für die Einheiten. Tippst du auf einen Tag, öffnet sich die Wochenansicht. Dort kannst du Einheiten **ändern** (Datum, Uhrzeit, Art des Trainings, Titel, Dauer, Notiz), **absagen** und **zurücksetzen**. Wird die Art geändert (z. B. Gravel → Yoga wegen Regen), zählt die neue Art für die Strava-Zuordnung und die Berichte; der Bericht zeigt „statt Gravel“ und wertet ersetzte statt ausgelassene Einheiten positiv.
- **Einstellungen:** FTP, Gewicht und HF-Zonen. Unter **Plan bearbeiten** änderst du Rennen, Phasen, Entlastungswochen und die Standardwoche. Nach jeder Änderung erzeugt die App den Plan automatisch neu. Deine manuellen Verschiebungen und Absagen bleiben dabei erhalten.

### Planregeln

| Phasentyp | Was geplant wird |
|---|---|
| Training | Standardwoche. In Entlastungswochen Dauer × Faktor (Standard 0,6) |
| Tapering | Standardwoche mit 50 % Dauer, keine Kraft in den letzten 7 Tagen vor dem Rennen, kurze Intervalle |
| Rennen | nur die Renntage |
| Erholung | Yoga & Mobility und eine lockere Gravel-Ausfahrt (50 %) |
| Pause | nichts |

**Winterregel Laufintervalle** (`lib/plan/run-intervals.ts`): Bis zur Zeitumstellung am 28.3.2027 sind die Mittwochs-Intervalle Laufeinheiten (Laufband im Studio oder draußen), weil es abends zu dunkel und kalt fürs Rad ist und kein Rollentrainer da ist. Jede Einheit bekommt die Anleitung als Notiz (auch im Kalender-Abo):

| Zeitraum | Hauptteil | Dauer |
|---|---|---|
| Phase 1 (bis 20.12.) | 6–8× 1–2 min zügig (Z3–Z4), je 1–2 min gehen/traben | 40–50 min |
| Januar | Schwelle 3× 8–10 min Z4, je 3 min traben | 50–60 min |
| Februar | Schwelle 3× 10–12 min Z4, je 3 min traben | 55–65 min |
| März bis 28.3. | 5× 3 min sehr hart (Z4–Z5), je 3 min locker | 45–50 min |

In Entlastungswochen: Intervalle halbieren, Dauer × 0,6. Ab Mi 31.3.2027 wieder Rad-Intervalle laut Standardwoche.

Ausnahmen aus dem Seed:
- So 22.11.26: Gravel entfällt.
- Sa 5.6.27: Enduro wird auf So 6.6. verschoben, das Gravel am 6.6. entfällt.

---

## Lokal entwickeln (optional)

Du brauchst dafür keinen Mac. Zwei Wege:

**Variante A: GitHub Codespaces (nur Browser)**

1. Gehe im Repo auf **Code → Codespaces → Create codespace on main**.
2. Lege im Terminal die Datei `.env.local` an (siehe unten).
3. Führe `npm install` und dann `npm run dev` aus.

**Variante B: Windows**

1. Installiere [Node.js 22 LTS](https://nodejs.org) und [Git](https://git-scm.com).
2. Führe aus:

   ```bash
   git clone https://github.com/CodeFux94/Main.git enduro-one
   cd enduro-one
   npm install
   copy .env.example .env.local   # dann Werte eintragen
   npm run dev                    # → http://localhost:3000
   ```

### Nützliche Befehle

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver |
| `npm test` | Unit-Tests (Plan-Generator, Datum, ICS) |
| `npm run lint` / `npm run typecheck` | Codequalität |
| `npm run build` | Produktions-Build |
| `npm run seed:sql` | `supabase/seed.sql` aus `lib/plan/seed-data.ts` neu erzeugen |

## Projektstruktur

```
app/
  (app)/            Seiten mit Login-Pflicht: Dashboard, Kalender, Erfolge, Berichte, Einstellungen
  login/            Login mit E-Mail + Passwort
  api/ics/[token]/  Kalender-Feed
  api/strava/       Verbinden, Rücksprung (callback), Webhook
  api/cron/         Täglicher Abgleich + Montags-Review (Vercel Cron)
  api/health/       Statusseite
  manifest.ts       PWA-Manifest
components/         UI-Bausteine
lib/
  plan/             Plan-Generator, Seed-Daten, Status, Zuordnung, Sync in die DB
  strava/           Strava-Client (OAuth, Rate-Limits), Import, Webhook-Verarbeitung
  metrics/          Wochenkennzahlen, Serien, Bestwerte, Badges
  reports/          Wochen- und Phasenberichte (Regeln + Speicherung)
  supabase/         Supabase-Clients (Nutzer-Sitzung / Secret Key)
  dates.ts, ics.ts  Datums- und iCalendar-Hilfen
proxy.ts            Sitzung erneuern + Login-Schutz (früher „middleware“)
public/sw.js        Service Worker (Offline-Fallback, Asset-Cache)
supabase/           SQL-Migrationen und Seed
tests/              Vitest-Tests
```

## Sicherheit

- Secrets stehen nur in Umgebungsvariablen. `.env*` ist per `.gitignore` ausgeschlossen, mit Ausnahme von `.env.example`.
- In allen Tabellen ist Row Level Security aktiv: Nur angemeldete Nutzer haben Zugriff. Registrierung ist abgeschaltet, und es ist nur `ALLOWED_EMAIL` erlaubt.
- Der Secret Key wird ausschließlich serverseitig verwendet (ICS-Feed, Strava-Webhook, Cron).
- Die Strava-Tokens liegen in einer Tabelle ohne RLS-Policy und sind damit nur für den Server lesbar.
- Webhook-Inhalte werden nie blind übernommen: Die App lädt jede gemeldete Aktivität direkt bei Strava nach.
- Der Cron-Endpunkt verlangt `CRON_SECRET`. Vercel sendet ihn automatisch mit.
