# Enduro One 2027 🏁

Persönliche Trainings-App für die Enduro-One-Saison 2027 (Schulenberg 25.–28.6., Roßbach 4.–5.9.).
Die App ist eine PWA: Sie lässt sich auf iPhone und iPad wie eine native App installieren, ist für Mobilgeräte gebaut, läuft im Dark Mode und auf Deutsch.

**Stack:** Next.js 16 (App Router, TypeScript), Tailwind CSS 4, Supabase (Postgres + Auth), Vercel.

## Stand der Etappen

| Etappe | Inhalt | Status |
|---|---|---|
| 1 | Grundgerüst, Login, Plan, Kalender, ICS-Feed, Einstellungen, PWA | ✅ |
| 2 | Strava-Anbindung (OAuth, Import, Webhook, Zuordnung) | ⏳ |
| 3 | Dashboard mit Kennzahlen und Charts | ⏳ |
| 4 | Erfolge | ⏳ |
| 5 | Berichte (Wochen- und Phasenreview per Cron) | ⏳ |

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

Beide Skripte kannst du gefahrlos mehrfach ausführen.

### Schritt 3 – Login einrichten (nur du darfst rein)

1. **Registrierung abschalten:** Gehe zu **Authentication → Sign In / Providers**. Schalte **Allow new users to sign up** aus. **Email** bleibt aktiviert.
2. **Deinen Nutzer anlegen:** Gehe zu **Authentication → Users → Add user → Create new user**. Trage deine E-Mail-Adresse ein, vergib ein beliebiges Passwort (es wird nicht gebraucht) und setze den Haken bei **Auto Confirm User**.
3. **Code statt Link verschicken:** Gehe zu **Authentication → Emails → Templates → Magic Link** und ersetze den Inhalt zum Beispiel durch:

   ```html
   <h2>Dein Login-Code</h2>
   <p>Gib diesen Code in der App ein: <strong>{{ .Token }}</strong></p>
   ```

   Den Betreff kannst du auf „Dein Login-Code für Enduro One“ ändern.

   Warum ein Code? Ein Link aus der Mail öffnet sich auf dem iPhone in Safari und nicht in der installierten App. Dann wärst du in der App nicht eingeloggt. Den Code tippst du dagegen direkt in der App ein.

> Hinweis: Der eingebaute Mailversand von Supabase ist auf wenige Mails pro Stunde begrenzt. Für einen einzelnen Nutzer reicht das. Die Sitzung bleibt ohnehin lange bestehen.

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
3. Klappe **Environment Variables** auf und trage vier Variablen ein (siehe [`.env.example`](.env.example)):

   | Name | Wert |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key |
   | `SUPABASE_SECRET_KEY` | Secret key |
   | `ALLOWED_EMAIL` | deine E-Mail-Adresse (dieselbe wie in Schritt 3) |

4. Klicke auf **Deploy**. Nach etwa einer Minute bekommst du eine Adresse wie `https://enduro-one-2027.vercel.app`.

**Automatisches Deployment:** Vercel ist jetzt mit dem Repo verbunden.
- Jeder Push auf `main` geht automatisch live.
- Jeder Pull Request bekommt eine eigene Vorschau-URL. Damit die Vorschau funktioniert, müssen die Variablen auch für **Preview** gesetzt sein. Das ist standardmäßig der Fall.
- Prüfen kannst du das unter **Project → Settings → Git**: Dort muss die Production Branch `main` sein.

### Schritt 6 – Erster Start

1. Öffne die Vercel-Adresse, gib deine E-Mail-Adresse ein und tippe auf **Login-Code anfordern**.
2. Gib den Code aus der Mail ein.
3. Öffne **Kalender → Plan erzeugen**. Die App legt alle Einheiten vom 16.11.2026 bis zum letzten Rennen an.

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

## Die App benutzen

- **Kalender:** Monatsansicht mit farbigen Phasen, hervorgehobenen Rennen und Punkten für die Einheiten. Tippst du auf einen Tag, öffnet sich die Wochenansicht. Dort kannst du Einheiten **verschieben** (Datum und Uhrzeit), **absagen** und **zurücksetzen**.
- **Einstellungen:** FTP, Gewicht und HF-Zonen. Unter **Plan bearbeiten** änderst du Rennen, Phasen, Entlastungswochen und die Standardwoche. Nach jeder Änderung erzeugt die App den Plan automatisch neu. Deine manuellen Verschiebungen und Absagen bleiben dabei erhalten.

### Planregeln

| Phasentyp | Was geplant wird |
|---|---|
| Training | Standardwoche. In Entlastungswochen Dauer × Faktor (Standard 0,6) |
| Tapering | Standardwoche mit 50 % Dauer, keine Kraft in den letzten 7 Tagen vor dem Rennen, kurze Intervalle |
| Rennen | nur die Renntage |
| Erholung | Yoga & Mobility und eine lockere Gravel-Ausfahrt (50 %) |
| Pause | nichts |

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
  login/            Login mit E-Mail-Code
  api/ics/[token]/  Kalender-Feed
  manifest.ts       PWA-Manifest
components/         UI-Bausteine
lib/
  plan/             Plan-Generator, Seed-Daten, Status, Sync in die DB
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
- Der Secret Key wird ausschließlich serverseitig verwendet (ICS-Feed, ab Etappe 2 auch Strava-Webhook und Cron).
