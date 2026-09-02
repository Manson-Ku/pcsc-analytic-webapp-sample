# PCSC Analytic Web App Sample

Reference implementation / business-technology translation sample for the PCSC analytics Web App login, authorization, and report-access flow.

> This repository is **not** a production IAM / BI implementation. It defines a concrete, reviewable business scenario, state machine, adapter contracts, mock reports, and interaction flow so PIC / implementation teams can replace the mock sources with existing enterprise systems.

## Scope

This sample separates four concerns that must not be conflated:

1. **Store Context** — which store context the current device/session represents.
2. **Human Identity** — who the current human user is.
3. **Authorization** — which stores that person is allowed to access.
4. **Selected Store** — which authorized store the UI is currently showing.

Key business rules represented here:

- General store reports can be shown from store context without requiring every store employee to sign in personally.
- Sensitive reports require a separate human identity step.
- Store manager / area advisor sensitive access is based on their authorized store list, not the physical store they are currently standing in.
- When a human session expires on a shared store device, the app clears the human/sensitive session and returns to the store general report; it does not log out the underlying store context.
- If a user enters sensitive mode while physically at an authorized store, that store may be used as the initial UI selection only. It never narrows the user's actual authorization.
- Report values in this repository are **Mock Data**. Production BigQuery RLS and Looker Studio / BI integration belong to the PCSC / PIC implementation layer.

## Repository layout

```text
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

## Run the sample

No build step is required.

Open `sample/index.html` in a browser, or serve the repository with any static HTTP server.

Example:

```bash
python -m http.server 8080
```

Then open:

```text
http://localhost:8080/sample/
```

## What the interactive sample demonstrates

```text
A 店 WebSC
→ A 店一般 Mock 報表
→ 點擊進階 / 機敏報表
→ 模擬王店長或陳區顧問登入
→ resolve Allowed Stores
→ 顯示可切換的機敏 Mock 報表
→ 模擬 Human Session Timeout
→ 清除個人權限
→ 回到 A 店一般報表
```

也可以切換成「個人公司電腦」入口，驗證沒有 Store Context 時仍可完成個人登入並查看其授權門市。

## Integration boundary

The sample uses mock providers only. A future implementation team should replace the following interfaces with PCSC / PIC implementations without changing the business state machine:

```text
StoreIdentityProvider
HumanIdentityProvider
AuthorizationProvider
```

The production data/report path is intentionally left pluggable:

```text
Web App Identity / Authorization
        ↓
trusted server-side access check
        ↓
BigQuery RLS / Authorized Views / existing enterprise data ACL
        ↓
Looker Studio or other BI presentation layer
```

The exact SSO, BigQuery RLS, Looker Studio embedding, token, and credential architecture is not prescribed by this sample. The implementation must preserve the business rule that requested store data is limited to the current human's authorized store scope.

See:

- `docs/03-adapter-contract-v0.1.md`
- `docs/05-report-data-boundary-v0.1.md`

## Status

- Reference Spec: v0.1
- Interactive Mock Report Sample: implemented
- Production SSO / IAM: out of scope
- Production BigQuery RLS: implementation-team responsibility
- Production Looker Studio / BI integration: implementation-team responsibility
- Device trust / MDM integration: out of scope
- Session timeout value: configurable / TBD
