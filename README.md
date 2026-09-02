# PCSC Analytic Web App Sample

Executable Reference Specification for the PCSC analytics Web App login, authorization, state ownership, and report-access flow.

> This repository is **not** a production IAM / BI implementation. It translates the confirmed business scenarios into a reviewable specification, state machine, state-ownership contract, adapter contracts, acceptance scenarios, and an interactive Mock Web App for PIC / implementation teams.

## Entry points

- **Specification SSOT:** [`SPEC.md`](./SPEC.md)
- **Interactive Sample:** [`sample/`](./sample/)
- **GitHub Pages:** `https://manson-ku.github.io/pcsc-analytic-webapp-sample/sample/`

The repository includes `.github/workflows/pages.yml` for automatic deployment from `main`.

## What this repository means

```text
SPEC.md
= Business Requirements + Acceptance Criteria + State Ownership SSOT

sample/
= Executable behavior reference + State Machine Inspector

docs/
= Detailed state machine / interface / assumption / data-boundary notes

Production implementation
= PIC / PCSC implementation-team responsibility
```

The sample separates four business contexts:

1. **Store Context** — which store context the current device/session represents.
2. **Human Identity** — who the current human user is.
3. **Authorization** — which stores that person is allowed to access.
4. **Selected Store** — which authorized store the UI is currently requesting/showing.

It also separates three runtime ownership layers:

```text
Client / Browser
→ owns interaction / proposed state

Server / BFF / Session / Enterprise Identity Layer
→ owns verified identity and authorization truth

Trusted Data / BI Layer
→ owns final row-access enforcement
```

Core principle:

> **Client owns interaction state; Server owns identity and authorization truth; Data layer owns final row-access enforcement.**

## Core business rules

- General store reports can be shown from Store Context without requiring every store employee to sign in personally.
- Sensitive reports require a separate Human Identity step.
- Company SSO login success does **not** automatically grant report authorization.
- Store manager / area advisor access is based on `allowed_store_codes`, not the physical store or device currently in use.
- Store Context may define the initial Selected Store only when that store is already authorized.
- Human-session timeout on a shared WebSC clears Human Identity / Authorization and returns to the store general report without clearing Store Context.
- Frontend filters, URL parameters, cookies, local state, or Looker Studio filters are not authorization truth.
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
  06-state-ownership-runtime-v0.2.md
sample/
  index.html
  app.js
  styles.css
```

## State Machine Inspector

The right-hand Inspector in the Sample exposes four review views:

```text
Current State
→ current browser-side runtime snapshot

Machine JSON
→ states / events / transitions / guards / adapters

Ownership
→ which state belongs to Client, Server, or Data Layer

Guards
→ live evaluation of sensitive-access guards
```

The Sample executes all Mock state in Browser JavaScript because GitHub Pages is static. This is an executable explanation of the contract, **not** the proposed Production security architecture.

For Production state placement and mutation rules, see [`docs/06-state-ownership-runtime-v0.2.md`](./docs/06-state-ownership-runtime-v0.2.md).

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
Browser Interaction State
        ↓
Server-side Identity / Session / Authorization
        ↓
trusted server-side access check
        ↓
BigQuery RLS / Authorized Views / existing enterprise data ACL
        ↓
Looker Studio or other BI presentation layer
```

The exact Google Workspace / SSO, AOM mapping, Server Session, BigQuery RLS, Looker Studio embedding, token, and credential architecture is intentionally left pluggable.

See:

- [`docs/03-adapter-contract-v0.1.md`](./docs/03-adapter-contract-v0.1.md)
- [`docs/05-report-data-boundary-v0.1.md`](./docs/05-report-data-boundary-v0.1.md)
- [`docs/06-state-ownership-runtime-v0.2.md`](./docs/06-state-ownership-runtime-v0.2.md)

## Mock data policy

All names, accounts, store codes, KPIs, revenue values, rankings, and report values in `sample/` are **DEMO / MOCK DATA**. They exist only to make the business scenarios executable and reviewable.

## Status

- Executable Reference Specification: `v0.2`
- Interactive Mock Report Sample: implemented
- State Machine Inspector: implemented
- State Ownership / Runtime Contract: implemented
- GitHub Pages deployment: active
- Production SSO / IAM: out of scope
- Production Server Session / BFF design: PIC / implementation-team decision
- Production BigQuery RLS: PIC / implementation-team responsibility
- Production Looker Studio / BI integration: PIC / implementation-team responsibility
- Device trust / MDM integration: out of scope / TBD
- Human-session timeout value: configurable / TBD
