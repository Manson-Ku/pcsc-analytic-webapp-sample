# State Ownership / Runtime / Mutation Model v0.2

## 目的

本文件回答四個問題：

1. **狀態機是什麼？**
2. **狀態放在哪一層？**
3. **每一層的職責是什麼？**
4. **狀態由誰、透過什麼事件變動？**

核心原則：

> **Client owns interaction state; Server owns identity and authorization truth; Data layer owns final row-access enforcement.**

本 Sample 為了可操作展示，將完整狀態機模擬在 Browser；這不代表 Production 應把可信身分與授權真相放在 Client。

---

## 1. State Machine 的定義

此專案所稱「狀態機」不是單純一個 JSON，也不是一個 `logged_in=true/false`。

它是：

```text
States
+ Events
+ Transitions
+ Guards
+ Context
+ State ownership rules
```

例如：

```text
GENERAL_MODE
  -- REQUEST_SENSITIVE --> HUMAN_AUTH_REQUIRED

HUMAN_AUTH_REQUIRED
  -- AUTH_SUCCESS --> HUMAN_AUTHENTICATED

HUMAN_AUTHENTICATED
  -- AUTHORIZATION_RESOLVED --> AUTHORIZATION_RESOLVED

AUTHORIZATION_RESOLVED
  -- ENTER_SENSITIVE [selectedStoreAllowed] --> SENSITIVE_MODE
```

Guard 決定某一個 transition 是否允許發生。

---

## 2. Production 應拆成三個狀態層

### Layer A｜Client Interaction State

位置：Browser / Web App。

主要內容：

```text
requestedView
selectedStoreCode
navigation state
UI filters
return URL
panel open/close
store context hint / last selected store preference
```

Client 可以直接變更這些狀態。

例如：

```json
{
  "requestedView": "sensitive",
  "selectedStoreCode": "B001"
}
```

這表示：

> Browser 想看 B001。

不是：

> Browser 已被授權看 B001。

Client State 是 **proposed / interaction state**，不是 Authorization Truth。

可選擇持久化於：

```text
memory
sessionStorage
localStorage
non-sensitive cookie
URL query / route
```

但不能因為狀態存在 Browser 就自動視為可信。

---

### Layer B｜Server Session / Identity / Authorization State

位置：Server / BFF / Session Service / Enterprise Identity Layer。

這一層是正式系統的可信任狀態。

主要內容：

```text
verified Store Context
Human Identity
Authentication status
Role
Allowed Stores
Sensitive / elevated session status
Session expiry
```

例如：

```json
{
  "session_id": "opaque-session-id",
  "store_context": {
    "store_code": "A001",
    "verified": true
  },
  "human": {
    "user_id": "USER-001",
    "authenticated": true
  },
  "authorization": {
    "role": "STORE_MANAGER",
    "allowed_store_codes": ["A001", "B001"]
  },
  "sensitive_session": {
    "active": true,
    "expires_at": "TBD"
  }
}
```

Client 不得直接宣告：

```text
I am USER-001
I am STORE_MANAGER
I can access A001/B001
```

這些只能由可信來源建立或驗證，例如：

```text
Enterprise SSO
Google Workspace Identity
AOM / employee mapping
Authorization SSOT
Server session
```

---

### Layer C｜Data Access Enforcement

位置：Trusted API / BigQuery RLS / Authorized View / existing enterprise ACL。

這一層負責最後一個問題：

> 這一次資料請求到底可以讀哪些 rows？

例如 Client 提出：

```text
requestedStoreCode = B001
```

Server 已知：

```text
allowedStoreCodes = [A001, B001]
```

正式資料請求必須滿足：

```text
B001 in [A001, B001]
→ ALLOW
```

如果 Client 用 DevTools 改成：

```text
requestedStoreCode = C001
```

則：

```text
C001 not in [A001, B001]
→ DENY / 403 / no rows
```

Looker Studio filter、iframe parameter 或 UI 隱藏都不能取代這一層。

---

## 3. State Ownership Matrix

| State / Context | Client 可讀 | Client 可直接改 | Server / Trusted Layer 是 SSOT | 最終用途 |
|---|---:|---:|---:|---|
| `requestedView` | Yes | Yes | No | UI navigation |
| `selectedStoreCode` | Yes | Yes | No；Server 必須驗證 | 使用者想看的門市 |
| `lastSelectedStore` | Yes | Yes | No | UX preference |
| `storeContextHint` | Yes | Yes | No | 提示 / bootstrap |
| `verifiedStoreContext` | Yes | No | Yes | 一般門市 Context |
| `human.userId` | Yes | No | Yes | Human Identity |
| `authenticated` | Yes | No | Yes | Authentication truth |
| `role` | Yes | No | Yes | Authorization context |
| `allowedStoreCodes` | Yes | No | Yes | Data access scope |
| `sensitiveSession.active` | Yes | No | Yes | 機敏模式有效期 |
| report rows | Read result only | No | Yes / Data Layer | 最終資料結果 |

---

## 4. Cookie / Browser Storage 原則

### 可以由 Client 自主管理

例如：

```text
preferred_store=A001
last_report=sales
sidebar_collapsed=true
```

這些只是 Preference。

### 不應把可信授權直接放成可任意修改 Cookie

不建議：

```text
role=STORE_MANAGER
allowedStores=A001,B001
isSensitive=true
```

然後 Server 直接相信 Browser 回傳內容。

正式 Session 建議至少符合等效原則：

```text
HttpOnly
Secure
SameSite
```

Cookie 可以只保存 opaque session id；真正的 Identity / Authorization State 留在 Server Session Store。

若正式架構採 signed/encrypted token，也必須由 Server 驗證完整性與有效期。

---

## 5. State 如何變動

狀態應由 **Event** 驅動，而不是任意散落的變數修改。

### BOOT

```text
Browser opens Web App
→ BOOT
→ request / resolve Store Context
```

結果之一：

```text
STORE_CONTEXT_RESOLVED → GENERAL_MODE
STORE_CONTEXT_NONE     → PERSONAL_ENTRY
```

Production 中 Store Context 的可信結果應由 Server / Enterprise Adapter 驗證。

---

### Request Sensitive Report

Client 事件：

```text
REQUEST_SENSITIVE
```

如果沒有有效 Human Session：

```text
→ HUMAN_AUTH_REQUIRED
```

Client 只能「要求登入」，不能自己把 `authenticated=true`。

---

### Human Authentication

```text
Enterprise SSO / IdP
→ AUTH_SUCCESS
→ Server 建立 Human Identity
```

接著：

```text
AuthorizationProvider
→ user_id → role + allowed_store_codes
```

結果：

```text
AUTHORIZATION_RESOLVED
or
AUTHORIZATION_DENIED
```

---

### Selected Store Change

Client 可以：

```text
CHANGE_STORE(B001)
```

Client State 可立即變成：

```text
selectedStoreCode=B001
```

但真正資料請求必須再次執行：

```text
requestedStoreCode in allowedStoreCodes
```

因此 Client change 不等於 Authorization change。

---

### Logout / Idle Timeout

Human logout 或 idle timeout 應由 Server Session State 生效。

共用 A 店 WebSC：

```text
Before:
verifiedStoreContext=A001
human=USER-001
allowedStores=[A001,B001]
sensitiveSession=ACTIVE

IDLE_TIMEOUT

After:
verifiedStoreContext=A001    ← keep
human=null                   ← clear
allowedStores=[]             ← clear
sensitiveSession=INACTIVE    ← clear
view=GENERAL_MODE
```

這就是：

```text
logoutHuman() != logoutStoreContext()
```

---

## 6. Reference Production Flow

```text
Browser / Web App
────────────────────────────
Client Interaction State
- requestedView
- selectedStoreCode
- UX preference
        │
        │ request / event
        ▼
Server / BFF / Session Layer
────────────────────────────
Authoritative State
- verified Store Context
- Human Identity
- Authentication
- Role
- Allowed Stores
- Sensitive Session / Expiry
        │
        │ authorized request
        ▼
Data / BI Layer
────────────────────────────
Final Enforcement
- BigQuery RLS / Authorized View / ACL
- requestedStore in allowedStores
- Looker Studio presentation
```

---

## 7. Sample 與 Production 的差異

目前 GitHub Pages Sample 為純靜態網站，因此：

```text
MACHINE_SPEC
runtime state
mock authentication
mock authorization
```

全部在 Browser JS 執行。

這是為了讓分析團隊與 PIC 能操作、理解與 Review 狀態轉換。

它只模擬 Production Contract，不代表正式安全架構。

正式落地時應保留：

```text
States
Events
Transitions
Guards
Business invariants
Adapter contracts
```

但把可信狀態的 ownership 移到 Server / Data Layer。

---

## 8. 最小不可違反原則

```text
Client may propose state.
Client may not grant itself authorization.

Server owns identity truth.
Server owns authorization truth.

Data layer must independently enforce row scope.

Selected Store is a request.
Allowed Stores is authorization.

Cookie presence is not authorization unless verified by trusted server logic.

SSO success is identity, not report access.
```
