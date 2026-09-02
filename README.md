# PCSC Analytic Web App Sample

Executable Reference Specification for the PCSC analytics Web App login, authorization, and report-access flow.

> This repository is **not** a production IAM / BI implementation. It translates the confirmed business scenarios into a reviewable specification, state machine, adapter contracts, acceptance scenarios, and an interactive Mock Web App for PIC / implementation teams.

## Entry points

- **Specification SSOT:** [`SPEC.md`](./SPEC.md)
- **Interactive Sample:** [`sample/`](./sample/)
- **Expected GitHub Pages URL:** `https://manson-ku.github.io/pcsc-analytic-webapp-sample/`

The repository includes `.github/workflows/pages.yml` for automatic deployment from `main`.

### One-time GitHub Pages activation

GitHub requires the repository owner to enable Pages once before the workflow token can deploy the site.

In GitHub:

```text
Repository
→ Settings
→ Pages
→ Build and deployment
→ Source: GitHub Actions
```

After this one-time setting is enabled, re-run the `Deploy GitHub Pages` workflow or push any new commit to `main`. Future `main` updates deploy automatically.

## What this repository means

```text
SPEC.md
= Business Requirements + Acceptance Criteria SSOT

sample/
= Executable behavior reference

docs/
= Detailed state machine / interface / assumption / data-boundary notes

Production implementation
= PIC / PCSC implementation-team responsibility
```

The sample separates four concerns that must not be conflated:

1. **Store Context** — which store context the current device/session represents.
2. **Human Identity** — who the current human user is.
3. **Authorization** — which stores that person is allowed to access.
4. **Selected Store** — which authorized store the UI is currently showing.

## Core business rules

- General store reports can be shown from Store Context without requiring every store employee to sign in personally.
- Sensitive reports require a separate Human Identity step.
- Company SSO login success does **not** automatically grant report authorization.
- Store manager / area advisor access is based on `allowed_store_codes`, not the physical store or device currently in use.
- Store Context may define the initial Selected Store only when that store is already authorized.
- Human-session timeout on a shared WebSC clears Human Identity / Authorization and returns to the store general report without clearing Store Context.
- Frontend filters, URL parameters, or Looker Studio filters are UX controls, not data authorization.
- Production data access must enforce the equivalent of `requested_store_code ∈ allowed_store_codes` in a trusted server / data layer.

## Repository layout

```text
SPEC.md
index.html
.nojekyll
.github/
  workflows/
    pages.yml
docs/
  01-login-state-machine-v0.1.md
  02-scenario-sequence-v0.1.md
  03-adapter-contract-v0.1.md
  04-assumption-register-v0.1.md
  05-report-data-boundary-v0.1.md
sample/
  index.html
  app.js
  styles.css
```

## Interactive acceptance scenarios

The Sample is intended to be reviewed by both the analysis/business team and PIC developers.

```text
AC-01 A 店 WebSC → A 店一般 Mock 報表，無個人登入
AC-02 王店長登入 → Allowed Stores=A/B，A 店 WebSC 預設 A
AC-03 王店長 → 可以切 B，不應取得 C/D
AC-04 陳區顧問個人公司電腦 → 無 Store Context 仍可登入並看 A/B/C/D
AC-05 未授權公司使用者 → SSO identity success, authorization denied
AC-06 Shared WebSC timeout → 清 Human Session，保留 A 店 Store Context
AC-07 非 Allowed Store 的資料請求 → 必須由正式 data layer 拒絕
```

Full acceptance criteria are defined in [`SPEC.md`](./SPEC.md).

## Run locally

No build step is required.

```bash
git clone https://github.com/Manson-Ku/pcsc-analytic-webapp-sample.git
cd pcsc-analytic-webapp-sample
python -m http.server 8080
```

Then open:

```text
http://localhost:8080/
```

The root page redirects to `/sample/`.

## Integration boundary

The sample uses Mock providers only. A future implementation team should replace the following contracts with existing PCSC / PIC enterprise systems without changing the business state machine:

```text
StoreIdentityProvider
HumanIdentityProvider
AuthorizationProvider
```

Potential production path:

```text
Web App Identity / Authorization
        ↓
trusted server-side access check
        ↓
BigQuery RLS / Authorized Views / existing enterprise data ACL
        ↓
Looker Studio or other BI presentation layer
```

The exact Google Workspace / SSO, AOM mapping, BigQuery RLS, Looker Studio embedding, token, and credential architecture is intentionally not prescribed by this Reference Spec.

See:

- [`docs/03-adapter-contract-v0.1.md`](./docs/03-adapter-contract-v0.1.md)
- [`docs/05-report-data-boundary-v0.1.md`](./docs/05-report-data-boundary-v0.1.md)

## Mock data policy

All names, accounts, store codes, KPIs, revenue values, rankings, and report values in `sample/` are **DEMO / MOCK DATA**. They exist only to make the business scenarios executable and reviewable.

## Status

- Executable Reference Specification: `v0.1`
- Interactive Mock Report Sample: implemented
- GitHub Pages deployment workflow: implemented
- GitHub Pages site activation: one-time repository setting required
- Production SSO / IAM: out of scope
- Production BigQuery RLS: PIC / implementation-team responsibility
- Production Looker Studio / BI integration: PIC / implementation-team responsibility
- Device trust / MDM integration: out of scope / TBD
- Human-session timeout value: configurable / TBD
