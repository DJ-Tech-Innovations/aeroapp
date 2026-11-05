# AeroApp — Aircraft Tool Familiarization

Laravel 13 · Inertia + React 19 · MySQL · offline-first PWA (installable, Android APK via Trusted Web Activity).

Aircraft-maintenance students learn 50+ tools through interactive 3D models, narrated procedures, video and quizzes/exams — **online or fully offline**. Instructors follow their class's results; staff author content and publish it as versioned **content packs** from the admin portal.

| Area | URL | Built with | Who |
|---|---|---|---|
| Sign in / password reset | `/login` | Inertia React | everyone |
| **Admin portal** | `/admin` | Inertia React (T-Mobeli-style shell) | staff with `admin.access` |
| **Learner app (PWA)** | `/app` | React SPA + IndexedDB + service worker | students & instructors |
| Learner API | `/api/*` | Laravel + Sanctum (session cookie) | the learner app |

## Quick start (Laravel Herd)

```bash
cp .env.example .env && php artisan key:generate   # already done locally
mysql -uroot -e "CREATE DATABASE aeroapp; CREATE DATABASE aeroapp_test;"
composer install && npm install
php artisan migrate --seed          # roles + demo accounts + packs 1.1.0 / 1.2.0
php artisan storage:link
herd link aeroapp && herd secure aeroapp   # https://aeroapp.test (HTTPS is required for offline/PWA)
npm run dev                         # or: npm run build
php artisan test                    # 28 feature tests (uses the aeroapp_test database)
```

Demo accounts (password `password`, local only — the seeder refuses to run in production):

| Email | Role | Lands on |
|---|---|---|
| admin@demo.com | Super Administrator | `/admin` |
| editor@demo.com | Content Editor (custom role example) | `/admin` |
| instructor@demo.com | Instructor | `/app` |
| student@demo.com … student8@demo.com | Student | `/app` |

Production first admin: `php artisan aeroapp:create-admin you@school.edu --name="Your Name"`.

## Users, roles & permissions

Built on `spatie/laravel-permission`. **Admin → Roles & permissions** shows a permission matrix per role; **Admin → Users** assigns one or more roles per person.

* `super-admin` passes every check (`Gate::before`) and can't be restricted. Only a super admin can grant it.
* Built-in roles (`admin`, `instructor`, `student`) can be edited but not deleted; custom roles (e.g. *Content Editor*) can be created by copying another role.
* The learner experience comes from permissions: `app.learn` → student app, `app.instruct` → instructor app, `admin.access` → admin portal.
* The full permission list lives in `app/Support/Permissions.php`; `RolesAndPermissionsSeeder` syncs it and is safe to run on every deploy.

## How offline works

```
Admin authors tools/quizzes ──[Publish]──▶ immutable CONTENT PACK (JSON file + SHA-256 + changelog)
                                                   │  Learner: Settings → Content updates (manual)
Learner app ◀── download → verify SHA-256 → stage → apply in ONE IndexedDB transaction → cache videos/3D
   │  service worker caches the app shell + every JS/CSS/font chunk + the bundled pack
   └─ quiz attempts / profile edits queue on the device → upload when online → server re-scores them
```

* **First sign-in needs internet.** After that the app opens and works offline for 14 days (`AEROAPP_OFFLINE_DAYS`).
* **First launch** installs the bundled pack (`public/packs/pack-1.1.0.json`) with the same installer as updates.
* **Failed installs roll back** (single transaction). *Settings → Demo tools → Fail the next content install* proves it.
* **App updates:** every build changes `/sw.js` (it embeds the build hash), so devices pick up new versions; learners can apply them from *Settings → App version*.
* **Server scoring:** `POST /api/attempts` re-scores each attempt against the answer key of the pack it was taken with; tampered client scores are logged, never trusted. Exam attempt limits are enforced on the server.

## Deploying to Hostinger (shared hosting)

1. PHP ≥ 8.3 in hPanel, SSH on, free SSL on the domain (**HTTPS is mandatory** — service workers and the APK need it).
2. Upload the project (or `git pull`), point the domain's document root at `public/`.
3. `composer install --no-dev --optimize-autoloader && npm ci && npm run build` (or build locally and upload `public/build`).
4. `.env`: `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL=https://your-domain`, MySQL credentials, SMTP for password resets.
5. `php artisan migrate --force && php artisan db:seed --force` (production seeds roles only) → `php artisan storage:link` → `php artisan aeroapp:create-admin …` → `php artisan optimize`.

## Android APK

The learner app is a standards-compliant PWA, so the APK is a **Trusted Web Activity**: a thin Android shell that opens `https://your-domain/app` full-screen with the same offline storage. No second codebase.

1. Deploy to your HTTPS domain first.
2. Go to <https://www.pwabuilder.com>, enter `https://your-domain/app`, choose **Android → Generate** (or use Google's Bubblewrap CLI: `bubblewrap init --manifest https://your-domain/manifest.webmanifest`).
3. Put the package name and signing key SHA-256 in `.env`: `ANDROID_PACKAGE=com.yourschool.aeroapp`, `ANDROID_SHA256_FINGERPRINTS=AB:CD:…` — Laravel serves them at `/.well-known/assetlinks.json` so Android drops the browser bar.
4. Install the generated `.apk` on devices (or upload the `.aab` to Google Play).

## AI features (optional)

* **Meshy** turns 1–4 tool photos into a textured 3D model (Admin → Tools → *3D model & parts*).
* **Claude** (`claude-opus-5-5`, official Anthropic PHP SDK) suggests the named parts from the photos.
* Keys are entered in **Admin → Settings → AI services**, verified, then stored encrypted with `APP_KEY`; the browser only ever sees the last 4 characters.

## Code map

```
app/Domain/        PackService (publish/withdraw, checksum), AttemptService (sync + re-scoring), Scoring, QuizEngine,
                   ToolBuilder / QuizBuilder (validation → shared JSON), ToolExcel (template, export, dry-run import)
app/Services/      MeshyProvider, PartsSuggester (Claude)
app/Http/Controllers/{Admin,Api,Auth}/   ServiceWorkerController (/sw.js)
resources/js/pages/            Inertia pages (auth, admin/*, error)
resources/js/learner/          offline learner SPA (lib: db, installer, session, sync…; pages; components)
resources/js/shared/           data contracts, quiz engine, scoring, pack diff/checksum, 3D archetypes
resources/js/viewer/           three.js tool viewer + admin click-to-place preview
resources/sw/sw.js             service worker source
tests/Feature/                 Pest: auth, access, learner API & scoring, packs, Excel, users & roles
```

Icons: [UIcons by Flaticon](https://www.flaticon.com/uicons) (free licence — attribution shown in the sidebar and sign-in page).
