# City Reach

Staff, attendance, tasks, stock and sales for growing local businesses: one calm dashboard for
every branch. This repository is a **self-contained demo**. It has no backend and no secrets; all
data lives in your browser.

**Live demo:** https://cityreach-dashboard.vercel.app

![City Reach dashboard](docs/screenshots/dashboard.jpg)

## What you can do

Sign in with a login ID and password (the logins are listed under [Demo logins](#demo-logins) below, not in the app) and explore:

![Role picker](docs/screenshots/landing.jpg)

- **Owner**: everything a manager sees, plus branches, sales & finance and reports.
- **Manager**: dashboard, attendance, rota, leave & pay, tasks board, stock, suppliers, purchasing,
  food safety, equipment, documents, customer feedback, performance reports (PDF / CSV).
- **Employee** (phone-first): clock in with a selfie and location, my tasks, rota, attendance,
  payslips, leave requests, training & goals.

Writes really work: clock in, create and move tasks, receive stock, approve leave, add sales, and
so on. Changes are saved to `localStorage`. **Settings -> Reset data** restores the
original sample business (it also refreshes itself daily so the dates always look current).

| Manager, tablet                            | Employee, phone                                            |
| ------------------------------------------ | ---------------------------------------------------------- |
| ![Tasks board](docs/screenshots/tasks.jpg) | ![Employee clock in](docs/screenshots/employee-mobile.jpg) |

## Login and fingerprint

The sign-in screen takes a **login ID and password**, or a **fingerprint** (Touch ID, Face ID,
Windows Hello, Android fingerprint). Owners and managers create a login for each employee in
**Employees -> Add employee** and can reset it from **Edit** (managers only for employees; only an
owner for managers). Everyone changes their own password, and sets up fingerprint, in
**Settings -> Security** (employees: **Security** in the side menu; also in the account menu).

### Demo logins

Password for everyone: `Demo@1234`.

| Role     | Login ID                                                                   | Who                          |
| -------- | -------------------------------------------------------------------------- | ---------------------------- |
| Owner    | `owner`                                                                    | Amara Okafor                 |
| Manager  | `manager`                                                                  | Daniel Brooks                |
| Employee | `employee`                                                                 | Maya Patel                   |
| Others   | `liam`, `noah`, `sofia`, `jamal`, `ella`, `priya`, `tomas`, `sq-hana`, ... | the rest of the seeded staff |

The sign-in screen does not show these, and there is no quick-enter: every sign-in needs a valid
ID and password (or a registered fingerprint). IDs are not case-sensitive. After 5 wrong passwords
in a row an account waits 30 seconds. **Settings -> Reset data** restores the original passwords
and removes fingerprints; the automatic daily refresh keeps passwords and fingerprints.

### How fingerprint works

It is real device biometrics through WebAuthn: `navigator.credentials.create()` (set up) and
`.get()` (sign in) with `authenticatorAttachment: 'platform'`, `userVerification: 'required'` and
`residentKey: 'preferred'`. The OS shows its own fingerprint / Face ID / screen-lock prompt; the
fingerprint never reaches the page. The device signs a one-time challenge with a private key it
keeps, and the app checks the signature with the public key stored at set-up.

- **Set up** (Settings -> Security -> _Set up fingerprint on this device_): registers a platform
  credential and stores its id, public key, label and date for that person. A person can register
  several devices and remove any of them.
- **Sign in** (_Sign in with fingerprint_): asks the device to prove itself for the credentials
  registered **in this browser**; if the check passes, that person is signed in.
- **Checks done** (`apps/web/src/lib/webauthn-verify.ts`): challenge round trip (single use, 2
  minutes), origin, rpId hash, user-present and user-verified flags, the signature against the
  stored public key (ES256 / RS256), and the signature counter.
- **Feature detection**: `PublicKeyCredential` and
  `isUserVerifyingPlatformAuthenticatorAvailable()` are checked first; if the browser or device
  cannot do it the screen says so in plain words, and nothing crashes. Cancelling or a time-out is
  shown as a calm message, not an error.
- **Domain**: the credential's `rpId` is `location.hostname`, never hard-coded, so it works on
  `localhost`, on `cityreach-dashboard.vercel.app` and on preview URLs. A credential is tied to
  the domain it was made on: set it up again on each URL you use (a new preview URL = a new domain).
- **Needs** a secure page (`https://` or `localhost`) and a device with a fingerprint reader, Face
  ID or a screen lock set up (Touch ID / Face ID, Windows Hello, or an Android fingerprint).

### Honest limits

This is a demo with **no server**, so none of this is server-side security.

- Passwords are never stored in plain text (PBKDF2-SHA256, 210,000 rounds, a random salt per
  password, WebCrypto), but the hashes live in this browser's `localStorage`, and the signed-in
  session is just a value in `localStorage`. Anyone with this browser's storage or devtools can
  bypass every check.
- The fingerprint checks run in the browser against the stored public key. They show the real flow
  and reject forged or replayed responses, but real security needs them on a server.
- Fingerprint sign-in only offers credentials registered in this browser; it cannot sign in a
  person on a device where it was never set up.

### Swapping in a real backend

Sign-in is split so a backend replaces one file:

1. `apps/web/src/lib/webauthn.ts`: browser only. Takes plain options (challenge, rpId, ids) and
   returns plain results (`clientDataJSON`, `authenticatorData`, `signature`, public key...). It
   verifies nothing.
2. `apps/web/src/lib/webauthn-verify.ts` and `password.ts`: the checks and hashing, pure functions.
3. `apps/web/src/features/auth/api.ts`: issues the challenge, stores the public key, verifies the
   assertion, hashes and verifies passwords, and starts the session. Today it runs on the local
   store; with a backend, `beginDeviceRegistration` / `finishDeviceRegistration`,
   `beginDeviceLogin` / `finishDeviceLogin` and `signInWithPassword` become a challenge endpoint, a
   verify endpoint, a server-side password check and a server session. The UI and the browser
   module do not change.

## Run it

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm check      # format, lint, typecheck, tests
pnpm build      # static build in apps/web/dist
```

Node 22+ and pnpm.

## How it is built

React 19, Vite, TypeScript, Tailwind CSS 4, shadcn/ui primitives, TanStack Query, React Hook Form

- Zod, Recharts, jsPDF. pnpm monorepo:

```
apps/web/          the app (UI -> queries -> api -> local store)
packages/shared/   zod schemas, types and the business rules (unit-tested)
```

The feature `api.ts` files talk to an in-memory document store persisted to `localStorage`
(`apps/web/src/lib/store`), seeded with a realistic business (staff, a week and more of
attendance, tasks, stock, suppliers, purchase orders, sales, expenses, payslips, feedback,
documents, rota). The camera, GPS and file upload are believable local mocks. See
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DATA_MODEL.md](docs/DATA_MODEL.md) and
[docs/FEATURES.md](docs/FEATURES.md).

## Design

The theme is "Ink & Stone": near-black ink on warm stone and white with a soft peach accent, all defined as tokens in `apps/web/src/index.css`.
All colours are tokens in `apps/web/src/index.css` (light and dark theme); type is Inter with
Fraunces for headings. The wordmark is traced from the supplied artwork.
