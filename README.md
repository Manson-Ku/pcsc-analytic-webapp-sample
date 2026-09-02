# PCSC Analytic Web App Sample

Executable Reference Specification for the PCSC analytics Web App **Store Device Binding、Human Login、Authorization、State Ownership 與 Report Access** flow.

> This repository is **not** a production IAM / BI implementation. It translates confirmed business scenarios into a reviewable specification, state machine, adapter contracts, acceptance scenarios, and an interactive Mock Web App for PIC / implementation teams.

## Entry points

- **Specification SSOT:** [`SPEC.md`](./SPEC.md)
- **Interactive Sample:** [`sample/`](./sample/)
- **GitHub Pages:** `https://manson-ku.github.io/pcsc-analytic-webapp-sample/sample/`
- **Device Binding Detail:** [`docs/07-store-device-binding-v0.3.md`](./docs/07-store-device-binding-v0.3.md)

## v0.3 核心決議

門市裝置的 Store Context 不再以模糊的「WebSC 裝置」假設表示，而是明確定義為：

```text
首次綁定
→ 使用門市 Google Workspace 帳號驗證
→ Google account map 到唯一 storeCode
→ Server 建立 Store Device Binding
```

之後 App 進站時：

```text
BOOT
→ Server resolve Device Binding
→ Binding ACTIVE
→ verified Store Context
→ General Store Report
```

因此四個概念必須分離：

```text
Store Google Account Login
!= Store Device Binding
!= Human Session
!= Human Authorization
```

尤其：

```text
logoutHuman() != unbindDevice()
IDLE_TIMEOUT != unbindDevice()
```

店長退出機敏 Human Session 後，已綁定的門市裝置仍保持 Store Context，回到該店一般報表。

只有明確的：

```text
UNBIND_DEVICE
```

才解除門市 Device Binding。

## Sample 可以怎麼測

```text
情境 A：已綁定 A 店的裝置
→ BOOT resolve Device Binding=A001
→ 直接看到 A 店一般報表
→ 王店長 Human Login
→ Allowed Stores=A/B
→ Sensitive Mode
→ Human Logout / Timeout
→ Device Binding 仍為 A001
→ 回 A 店一般報表
```

```text
情境 B：尚未綁定的裝置
→ Device Binding=NONE
→ 可以選：
   1. 用 A 店門市 Google 帳號完成 Mock Binding
   2. 不綁定，直接做 Human Login 看自己的機敏報表
```

Sample 也提供獨立的「解除門市 Device Binding（Demo）」操作，用來驗證它與 Human Logout 是兩個不同事件。

## State Ownership

```text
Browser / Web App
────────────────────
Interaction State
- requestedView
- selectedStoreCode
- UI preferences
- request bind / unbind
        │
        ▼
Server / BFF / Session
────────────────────
Authoritative State
- Device Binding
- verified Store Context
- Human Identity
- Human Session
- role
- allowedStoreCodes
- sensitive session expiry
        │
        ▼
Data / BI Layer
────────────────────
Final Enforcement
- requestedStore in allowedStores
- BigQuery RLS / Authorized View / ACL
- Looker Studio presentation
```

核心原則：

> **Client owns interaction state; Server owns Device Binding, identity and authorization truth; Data layer owns final row-access enforcement.**

## Provider / Adapter Contracts

Reference v0.3 需要四個主要能力：

```text
StoreAccountResolver
StoreDeviceBindingProvider
HumanIdentityProvider
AuthorizationProvider
```

詳細：[`docs/03-adapter-contract-v0.1.md`](./docs/03-adapter-contract-v0.1.md)

## 「店長帳號 = 門市帳號」

即使正式環境最後使用相同 Google account 做兩個流程，也必須把它們視為兩次不同 purpose 的驗證：

```text
Store Binding Ceremony
→ 建立 / 驗證 Device Binding

Human Ceremony
→ 建立 Human Sensitive Session
```

所以店長 Human Logout 不應解除 Device Binding。

但如果該 Google account 是多人共用門市帳號，它本身不能唯一證明是哪一位自然人；如果機敏權限需要 person-level ACL，Production 仍需取得唯一 `userId` 的額外個人驗證來源。

## Repository layout

```text
SPEC.md
sample/
  index.html
  app.js
  styles.css
docs/
  01-login-state-machine-v0.1.md
  02-scenario-sequence-v0.1.md
  03-adapter-contract-v0.1.md
  04-assumption-register-v0.1.md
  05-report-data-boundary-v0.1.md
  06-state-ownership-runtime-v0.2.md
  07-store-device-binding-v0.3.md
.github/workflows/pages.yml
```

## Production responsibility boundary

Reference Sample / specification defines：

```text
Business Scenario
Device Binding semantics
State Machine
State Ownership
Adapter Contracts
Acceptance Criteria
Mock Report behavior
```

PIC / PCSC Production implementation owns：

```text
Google Workspace / SSO implementation
Store Google Account → storeCode mapping SSOT
Device Binding persistence / revoke / rotation
Human Identity implementation
user → role → allowed stores SSOT
Server-side authorization
BigQuery RLS / Authorized Views / ACL
Looker Studio integration
Audit / logging
Optional MDM / Device Trust hardening
```

## Status

```text
Executable Reference Spec: v0.3
Interactive Sample: implemented
Store Google Account Device Binding: specified + mocked
Production IAM / RLS / BI: out of scope
```
