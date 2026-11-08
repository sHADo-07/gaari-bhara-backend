# Gaari Bhara: Backend

NestJS + PostgreSQL backend for **Gaari Bhara**, a peer-to-peer vehicle rental information platform
(a middleman: no payments). Team 07, AIUB, CSC 4161.

This repository starts from the teacher's NestJS boilerplate. The changes we made are listed at the end.

## 1. Run it in 5 minutes

You need: **Node 22**, **pnpm** (`npm i -g pnpm`), and **Docker** (only for the database).

```bash
docker compose up -d              # starts PostgreSQL (user gaari / password gaari_dev_password)
cp .env.example .env              # on Windows: copy .env.example .env
pnpm install
pnpm migration:run                # builds ALL tables + loads 64 districts and 6 categories
pnpm seed:demo                    # creates 1 admin, 3 owners, 3 renters and prints their ids
pnpm start:dev                    # API on http://localhost:5000
```

* **Swagger (all routes, try them in the browser):** http://localhost:5000/api
* **Health check:** http://localhost:5000/health

Demo accounts (password for all: `Demo@12345`): `admin@gaaribhara.test`, `owner1..3@gaaribhara.test`,
`renter1..3@gaaribhara.test`.

### Commands

| Command | What it does |
| --- | --- |
| `pnpm start:dev` | Run with auto-restart |
| `pnpm migration:run` | Create / update all tables |
| `pnpm migration:rollback` | Undo the last migration |
| `pnpm db:reset` | DEV ONLY: drop everything and build it again |
| `pnpm seed:demo` | Demo users (safe to run again) |
| `pnpm test` | All tests (uses a separate `<db>_test` database, never your real one) |
| `pnpm lint` | Code check |
| `pnpm build` | Compile |

## 2. How to call private routes

**Real login (use this in Swagger / Postman):**
1. `POST /auth/login` with email and password. Copy `accessToken`.
2. In Swagger click **Authorize** and paste the token. In Postman use header `Authorization: Bearer <token>`.

**Temporary helper while you build** (only when `ALLOW_TEST_USER_HEADER=true`, never in production):
send header `x-test-user-id: <user id>` (ids are printed by `pnpm seed:demo`) instead of a token.
Your code does not change when we switch to the real login. It is the same `AuthGuard`.

## 3. How to add YOUR module (Arikh: posts, Adila: rents and reviews, Arijit: chat)

The tables of all modules already exist (see `src/database/migrations`). You write the code on top of them.

1. Make `src/modules/<name>/` with `entities/`, `dto/`, `<name>.service.ts`, `<name>.controller.ts`, `<name>.module.ts`.
2. Write your entity with `@Entity("table_name")`. Column names must match the migration (snake_case in the database).
3. In your module: `TypeOrmModule.forFeature([YourEntity])`. (This registers the entity. Do not skip it.)
4. Add `YourModule` to `imports` in `src/app.module.ts`.
5. Protect routes:
   ```ts
   import { AuthGuard, RolesGuard, Roles, CurrentUser, Role, AuthUser } from "@/modules/auth";

   @UseGuards(AuthGuard)                       // any signed-in user
   @UseGuards(AuthGuard, RolesGuard) @Roles(Role.OWNER)   // only owners
   me(@CurrentUser() user: AuthUser) { ... }   // user.id, user.role
   ```
   You do NOT import AuthModule. It is global.
6. Check ownership in your service (for example: only the author edits a post). Never trust the screen.
7. Write input rules as DTO classes with `class-validator` decorators (see `src/modules/auth/dto/register.dto.ts`).
   Unknown fields are rejected automatically. Shared cleaners are in `src/common/validations/transforms.ts`.
8. Add `@ApiTags`, `@ApiOperation` and `@ApiProperty` so Swagger shows your routes.
9. Write tests in `test/` (copy the style of `test/auth.e2e-spec.ts`).

### Rules for everyone

* **Errors:** throw Nest exceptions (`NotFoundException`, `ForbiddenException`...). Every error has the same shape:
  `{ statusCode, error, message, details?, path, timestamp }`. Database rule violations (duplicate, wrong link,
  overlapping dates) are turned into 409 / 400 automatically.
* **Privacy:** never return another user's **email or phone**. Use `UsersService.toPublic(user)` (id, name, role).
  Contact details are shown only by the Rent module, only when the rent is CONFIRMED or later.
* **Money** is an integer in poisha (1 taka = 100 poisha). **Time** is UTC. IDs are UUID (messages use a number).
* **Migrations:** never edit a migration that someone has already run. Add a NEW file in `src/database/migrations`
  with the next number. Only the owner of a table changes it.
* **Posts' `rent_status` column** is a copy for the feed. Only the Rent module (Adila) changes it.
* **Uploads:** files are saved under `uploads/` and served at `/uploads/...`. The folder is not in git, so create it
  in your code if it is missing (`mkdir` with `recursive: true`).
* Imports inside `src` use the `@/...` style (for example `@/modules/users/users.service`).

## 4. What is built (Registration and Login module + foundation)

| Route | Who | What |
| --- | --- | --- |
| `POST /auth/register` | everyone | Sign up as `RENTER` or `OWNER` (ADMIN is refused) |
| `POST /auth/login` | everyone | Returns a Bearer token |
| `POST /auth/logout` | signed in | This token stops working at once |
| `PATCH /auth/password` | signed in | Change password, all old tokens stop working |
| `GET /users/me`, `PATCH /users/me` | signed in | My profile, edit name and phone |
| `GET /admin/users` | admin | List users (pages, `role`, `status`, `q`) |
| `PATCH /admin/users/:id/suspend`, `/restore` | admin | Suspend or restore (tokens stop working at once) |
| `GET /health` | everyone | Health check with a database ping |

Security done: Argon2id password hashes; real token check (signature, expiry, logout list, suspended user,
password change); same answer for "wrong password" and "no such email"; sign-up/login rate limit
(10 per minute per IP); unknown fields rejected; helmet headers; admin accounts only from the seed, never from sign-up.

## 5. Tests

`pnpm test` runs 67 tests against a real PostgreSQL database:

* `test/auth.e2e-spec.ts`: register, login, tokens, logout, profile, password change, roles, admin, suspend.
* `test/database.e2e-spec.ts`: the database rules from the manual (unique, checks, no overlapping rents,
  one review per side, one chat per pair per post, a concurrency test with 20 people booking the same dates).

Add checks for your own tables to the database test file.

## 6. Not done yet (honest list)

* Email check and password reset (Should level; needs an email service). Refresh tokens.
* CI pipeline and deployment.
* The modules of the other members (their tables and migrations are ready).
* `ALLOW_TEST_USER_HEADER` is a development helper only.

## 7. What we changed in the teacher's boilerplate

* **Fixed:** `AuthGuard` returned `true` for any text without checking the token. It now really verifies it.
* **Fixed:** the role list belonged to another project (and `THESIS_SUPERVISOR` had the same value as `ROLE_USER`).
  It is now `RENTER`, `OWNER`, `ADMIN`.
* **Fixed:** the user decorator printed headers and user data to the console. Removed.
* **Fixed:** the validation pipe hid the reason for errors. Replaced by one shared pipe with clear details.
* **Fixed:** the app refused to start without mail settings, and tokens lived for one year. Mail settings are
  optional now; tokens last one day (`JWT_TTL`).
* **Fixed:** migration scripts did not wait for each step. They do now.
* **Removed:** unused parts from the other project (queue provider, in-memory cache, truncate and seeder scripts).
* **Added:** ESLint 9 config (the old one was not read), `docker-compose.yml` for PostgreSQL, Node 22 (`.nvmrc`).
