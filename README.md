# PCSC Analytic Web App Sample

這是一份給分析團隊與 PIC / 開發團隊共同 Review 的 **Executable Reference Specification（可執行需求規格）**。

它把「門市一般報表、門市裝置綁定、個人登入、跨店授權、Timeout、機敏資料權限」翻譯成：

```text
Business Rules
+ State Machine
+ State Ownership
+ Adapter Contracts
+ Acceptance Criteria
+ 可操作 Mock Web Sample
```

> 本 Repo **不是 Production IAM / BI 實作**。正式 Google Workspace / SSO、Server Session、BigQuery RLS、Looker Studio 與企業 ACL 由 PIC / PCSC 正式架構負責。

---

## 分析團隊到底想要什麼

如果只看這一段，開發者應能先理解需求，而不用先理解 State Machine。

1. **門市一般報表要低摩擦。** 已完成門市綁定的共用裝置進站後，要直接知道是哪一家店並顯示本店一般報表，不要求每位門市員工再做個人登入。
2. **門市裝置要先被綁定。** 第一次使用門市 Google Workspace 帳號驗證，將這個 Browser / Device 建立成該門市的 `Device Binding`；之後不需要每次重新輸入門市帳號。
3. **機敏報表是另一個 Human Login。** 店長 / 區顧問要看機敏資料時，要另外辨識「現在這個人是誰」，不能把門市 Device Binding 當成人員身分。
4. **可看哪些店跟著人，不跟著裝置。** 店長 / 區顧問能看的門市由 `allowedStoreCodes` 決定；人在 A 店裝置登入不代表只能看 A 店。
5. **Human Logout / Timeout 不得解除門市綁定。** 店長退出或閒置逾時後，只清除 Human Session / Authorization；已綁定的門市裝置仍回到該店一般報表。
6. **真正的資料權限要在可信層再擋一次。** 前端下拉選單、URL、Looker filter 都不是 Security Boundary；正式資料請求仍要驗證 `requestedStoreCode in allowedStoreCodes`。

PIC 不必把正式系統重寫成 Sample 的技術形式。只要既有架構能滿足以上 Business Behavior、State Ownership、Contract 與 Acceptance Criteria，即符合本 Reference Spec 的目的。

---

## 入口

- **可操作 Sample：** https://manson-ku.github.io/pcsc-analytic-webapp-sample/sample/
- **需求規格 SSOT：** [`SPEC.md`](./SPEC.md)
- **開發者 5 分鐘導讀：** [`docs/00-developer-quickstart-v0.3.md`](./docs/00-developer-quickstart-v0.3.md)
- **門市 Device Binding 規格：** [`docs/07-store-device-binding-v0.3.md`](./docs/07-store-device-binding-v0.3.md)
- **State Ownership：** [`docs/06-state-ownership-runtime-v0.2.md`](./docs/06-state-ownership-runtime-v0.2.md)
- **State Storage 建議：** [`docs/08-state-storage-recommendation-v0.3.md`](./docs/08-state-storage-recommendation-v0.3.md)
- **Adapter Contract：** [`docs/03-adapter-contract-v0.1.md`](./docs/03-adapter-contract-v0.1.md)

---

## 30 秒理解這個系統

系統有兩個必須分開的生命週期：

```text
Store Device Binding
= 這個 Browser / Device 被綁定成哪一家門市
= 長生命週期

Human Session
= 現在操作機敏報表的人是誰
= 短生命週期
```

門市裝置的明確辨認方式是：

```text
首次綁定
→ 使用「門市 Google Workspace 帳號」驗證
→ StoreAccountResolver
→ Google Account 對應唯一 storeCode
→ Server 建立 Store Device Binding
```

之後進站：

```text
BOOT
→ Server resolve Device Binding
→ Binding ACTIVE
→ verified Store Context
→ 顯示該店一般報表
```

店長 / 區顧問要看機敏報表時，另外建立 Human Session：

```text
Human Login
→ stable userId
→ AuthorizationProvider
→ role + allowedStoreCodes[]
→ Sensitive Mode
```

所以最重要的 Invariant 是：

```text
Store Google Account Login
!= Store Device Binding
!= Human Session
!= Human Authorization

logoutHuman() != unbindDevice()
IDLE_TIMEOUT != unbindDevice()
```

---

## 五個核心 Context / State

| 名稱 | 回答的問題 | 正式 SSOT |
|---|---|---|
| `Device Binding` | 這個 Browser / Device 綁定哪家店？ | Server |
| `Store Context` | 一般門市報表目前是哪家店？ | Server，由 Binding 解析 |
| `Human Identity` | 現在操作機敏報表的人是誰？ | Enterprise SSO / Server Session |
| `Authorization` | 這個人可以查看哪些門市？ | Authorization SSOT / Server |
| `Selected Store` | 使用者現在想看哪家店？ | Client interaction state；Server 仍須驗證 |

一句話：

> **Client 可以選擇想看哪一家店；Server 才能決定他有沒有權限看。**

---

## State 放在哪裡

```text
Browser / Web App
────────────────────────────
Client Interaction State
- requestedView
- selectedStoreCode
- UI preference
- request bind / unbind
        │
        ▼
Server / BFF / Session Layer
────────────────────────────
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
────────────────────────────
Final Enforcement
- requestedStoreCode in allowedStoreCodes
- BigQuery RLS / Authorized View / ACL
- Looker Studio presentation
```

核心原則：

> **Client owns interaction state; Server owns Device Binding, identity and authorization truth; Data layer owns final row-access enforcement.**

Sample 是純靜態 GitHub Pages，因此為了展示，以上狀態目前全部 Mock 在 Browser。這是 Demo runtime，不是 Production Security Architecture。

### 建議 Storage 類型

這裡只定義 persistence class，不綁死 Redis / SQL / Firestore 等產品：

```text
UI / Selected Store
→ Browser memory / route / sessionStorage

UX Preference
→ localStorage / non-sensitive cookie

Store Device Binding
→ durable server-side Binding Store / enterprise DB
→ Browser 只持 opaque binding/session id

Human Sensitive Session
→ short-lived server-side Session Store / server-verified IdP session

Authorization
→ AOM / HR / ACL authoritative SSOT
→ 必要時只做 short-TTL server cache

Final Row Access
→ Trusted API / BigQuery RLS / Authorized View / existing ACL
```

詳細：[`docs/08-state-storage-recommendation-v0.3.md`](./docs/08-state-storage-recommendation-v0.3.md)

---

## 開發者建議閱讀順序

第一次接手不用先把全部文件讀完，建議：

```text
1. 先操作 sample/
2. docs/00-developer-quickstart-v0.3.md
3. SPEC.md
4. docs/07-store-device-binding-v0.3.md
5. docs/06-state-ownership-runtime-v0.2.md
6. docs/08-state-storage-recommendation-v0.3.md
7. docs/03-adapter-contract-v0.1.md
8. docs/05-report-data-boundary-v0.1.md
```

Sample 右側的 `State Machine Inspector` 也可以直接切換：

```text
Current State   → 現在 Runtime State
Machine JSON    → States / Events / Transitions
Ownership       → Client / Server / Data Layer 誰負責什麼
Storage         → 各類 State 建議放在哪裡、生命週期多長
Integration Map → Mock 正式落地時要替換哪個 Adapter
Guards          → 目前 Guard 判斷結果
```

---

## Mock → Production 要替換哪些地方

Reference v0.3 有四個主要整合能力，加上一個最終資料 Guard：

| Contract | 正式系統要回答什麼 | 必要輸出 |
|---|---|---|
| `StoreAccountResolver` | 門市 Google Account 對應哪個門市？ | `storeCode` |
| `StoreDeviceBindingProvider` | 此 Browser / Device 是否有有效門市綁定？ | `bindingId`, `status`, `storeCode` |
| `HumanIdentityProvider` | 現在這個人是誰？ | stable `userId` |
| `AuthorizationProvider` | 這個人可以看哪些門市？ | `role`, `allowedStoreCodes[]` |
| Sensitive Data Guard | 這次實際資料請求能不能讀這家店？ | allow / deny / row scope |

PIC 可以使用既有 GWS、AOM、SSO、IAM、HR、ACL、內部 API 或其他企業系統實作上述 Contract。

不要求正式系統照抄 Sample code；要求的是 **Business State Machine 與 Invariant 不被破壞**。

---

## Sample 可以怎麼測

### 情境 A：已綁定 A 店的裝置

```text
BOOT
→ Device Binding=A001
→ A 店一般報表
→ 王店長 Human Login
→ Allowed Stores=[A001,B001]
→ Sensitive Mode
→ 切換 B001 可看 B 店
→ Human Logout / Timeout
→ Device Binding 仍為 A001
→ 回 A 店一般報表
```

### 情境 B：尚未綁定的裝置

```text
BOOT
→ Device Binding=NONE
```

可以選：

```text
A. 用 A 店門市 Google Account 完成 Mock Device Binding
   → Store Context=A001
   → A 店一般報表

B. 不綁定裝置
   → 直接 Human Login
   → Authorization
   → 查看自己 Allowed Stores 的機敏報表
```

Sample 另有獨立的「解除門市 Device Binding（Demo）」操作，用來確認：

```text
Human Logout
!=
UNBIND_DEVICE
```

---

## 「店長帳號 = 門市帳號」時怎麼處理

即使正式環境最後使用相同 Google Account 做兩個流程，也必須把用途拆開：

```text
Store Binding Ceremony
→ 目的：建立 / 驗證 Device Binding

Human Authentication Ceremony
→ 目的：建立 Human Session
```

因此店長退出 Human Session 不應解除門市 Device Binding。

但如果該 Google Account 實際上是多人共用門市帳號，它只能證明「這是該門市帳號」，不能唯一證明是哪一位自然人。若機敏報表採 person-level ACL，正式系統仍需取得唯一 `userId` 的個人驗證來源。

---

## Security Boundary

以下都不能當成正式 Authorization：

```text
URL ?store=A001
Client selectedStoreCode
hidden menu / disabled option
Browser localStorage
可被 Client 任意修改的 role / allowedStores cookie
Looker Studio filter
iframe parameter
```

正式資料層至少必須 enforce 等效規則：

```text
requestedStoreCode in server-resolved allowedStoreCodes
```

Client-side Guard 只負責 UX，不是 Security Boundary。

---

## PIC 接手最需要確認的 5 件事

```text
1. 門市 Google Account → storeCode 的正式 SSOT 在哪？
2. Device Binding 儲存在哪一層？如何 revoke / rotate？
3. Human SSO 如何取得唯一 stable userId？
4. userId → role → allowedStoreCodes 的正式 SSOT 在哪？
5. requestedStoreCode ∈ allowedStoreCodes 最終在哪個 Server / Data Layer enforce？
```

這 5 題確認後，主要 Production Integration Path 就已經明確。

---

## Repo 結構

```text
SPEC.md                              Business / Acceptance SSOT
sample/                              可操作 Executable Sample
  index.html
  app.js
  styles.css

docs/
  00-developer-quickstart-v0.3.md     開發者快速導讀
  01-login-state-machine-v0.1.md
  02-scenario-sequence-v0.1.md
  03-adapter-contract-v0.1.md
  04-assumption-register-v0.1.md
  05-report-data-boundary-v0.1.md
  06-state-ownership-runtime-v0.2.md
  07-store-device-binding-v0.3.md
  08-state-storage-recommendation-v0.3.md
.github/workflows/pages.yml           GitHub Pages 自動部署
```

規格優先順序：

```text
1. SPEC.md       → Business / Acceptance SSOT
2. sample/       → Executable Behavior Reference
3. docs/         → Detailed Technical Explanation
4. Production    → PIC / implementation team
```

如果 Sample 與 `SPEC.md` 不一致，先確認需求，再同步修改 Sample；不能把 Sample code 的偶然行為自動視為新需求。

---

## Responsibility Boundary

本 Reference Spec 負責定義：

```text
Business Scenario
Device Binding semantics
State Machine
State Ownership
Adapter Contracts
Acceptance Criteria
Mock Report behavior
```

PIC / PCSC Production implementation 負責：

```text
Google Workspace / Enterprise SSO
Store Google Account → storeCode mapping SSOT
Device Binding persistence / revoke / rotation
Human Identity implementation
user → role → allowed stores SSOT
Server-side authoritative session
Server-side authorization
BigQuery RLS / Authorized Views / ACL
Looker Studio integration
Audit / logging
Optional MDM / Device Trust hardening
```

---

## Status

```text
Executable Reference Spec: v0.3
Interactive Sample: implemented
Developer Quickstart: implemented
Store Google Account Device Binding: specified + mocked
State Machine Inspector: implemented
State Storage Recommendation: implemented
Production IAM / RLS / BI: out of scope
```
