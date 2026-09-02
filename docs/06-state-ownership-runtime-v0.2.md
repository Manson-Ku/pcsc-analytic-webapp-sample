# State Ownership / Runtime / Mutation Model v0.3

## 目的

本文件回答五個問題：

1. 狀態機是什麼？
2. 狀態放在哪一層？
3. 每一層的職責是什麼？
4. 狀態由誰、透過什麼事件變動？
5. **Store Device Binding 與 Human Session 為什麼必須是不同 state domain？**

核心原則：

> **Client owns interaction state; Server owns Device Binding, identity and authorization truth; Data layer owns final row-access enforcement.**

本 Sample 為了可操作展示，將狀態都模擬在 Browser；Production 不得因此把可信 Device Binding / Human Identity / Authorization 真相交給 Client。

---

## 1. State Machine 的定義

此專案所稱狀態機是：

```text
States
+ Events
+ Transitions
+ Guards
+ Context
+ State ownership rules
```

目前至少有兩組不同生命週期的 Server-side state domain：

```text
A. Store Device Binding State
B. Human / Sensitive Session State
```

這兩組狀態可以同時存在，但不得互相等同。

---

## 2. Store Device Binding State

### 目的

回答：

> 「目前這個 Browser / Device 是否已被綁定為某一家門市入口？」

Reference Decision：首次以門市 Google Workspace 帳號完成綁定。

```text
門市 Google Identity
→ StoreAccountResolver
→ storeCode
→ Server 建立 Device Binding
```

例如 Server State：

```json
{
  "device_binding": {
    "binding_id": "DEVICE-BIND-001",
    "status": "ACTIVE",
    "store_code": "A001",
    "verified_by_store_google_account": "store-a@7-11.example"
  },
  "verified_store_context": {
    "store_code": "A001"
  }
}
```

Google Account login 是建立 Binding 的 ceremony，不是 Binding 本身。

因此後續 App BOOT 應先由 Server 驗證既有 Binding：

```text
BOOT
→ RESOLVE_DEVICE_BINDING
→ ACTIVE binding
→ verifiedStoreContext=A001
→ GENERAL_MODE
```

---

## 3. Human / Sensitive Session State

### 目的

回答：

> 「現在操作機敏資料的人是誰？他能看哪些門市？」

例如：

```json
{
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

Human Session 通常較短，必須有 logout / timeout。

---

## 4. 兩組 Server State 的關係

已綁定 A 店裝置、尚未有人登入：

```text
deviceBinding=A001
human=null
→ A001 General Mode
```

王店長登入：

```text
deviceBinding=A001
human=USER-001
allowedStores=[A001,B001]
→ Sensitive Mode
```

王店長登出 / timeout：

```text
deviceBinding=A001       KEEP
human=null               CLEAR
authorization=[]         CLEAR
sensitiveSession=OFF     CLEAR
→ A001 General Mode
```

所以是正式 invariant：

```text
logoutHuman() != unbindDevice()
IDLE_TIMEOUT != unbindDevice()
```

只有另一個明確事件：

```text
UNBIND_DEVICE
```

才改變 Device Binding。

---

## 5. Production 三層 State Responsibility

### Layer A｜Client Interaction State

位置：Browser / Web App。

Client 可擁有：

```text
requestedView
selectedStoreCode
navigation state
UI filters
return URL
panel state
UX preferences
requestBind / requestUnbind action
```

Client 可以「要求綁定」或「要求看 B001」，但不能自己宣告：

```text
I am a bound store device
I am A001
I am USER-001
I can access B001
```

---

### Layer B｜Server Device / Identity / Authorization State

位置：Server / BFF / Session Service / Enterprise Identity Layer。

Server 是以下真相的 SSOT：

```text
deviceBinding.bindingId
deviceBinding.status
verifiedStoreContext
human.userId
authentication status
role
allowedStoreCodes
sensitiveSession.active
sensitiveSession.expiresAt
```

Reference 內建兩個不同 session lifecycle：

```text
Longer-lived Store Device Binding
Shorter-lived Human Sensitive Session
```

---

### Layer C｜Data Access Enforcement

位置：Trusted API / BigQuery RLS / Authorized View / existing enterprise ACL。

最後仍需 enforce：

```text
requestedStoreCode in allowedStoreCodes
```

Device Binding=A001 不代表 Human 自動有 A001 Sensitive Authorization。

---

## 6. State Ownership Matrix

| State / Context | Client 可讀 | Client 可直接改 | Server / Trusted Layer 是 SSOT | 生命週期 |
|---|---:|---:|---:|---|
| `requestedView` | Yes | Yes | No | UI |
| `selectedStoreCode` | Yes | Yes | No；Server/Data Guard 驗證 | UI |
| `deviceBinding.status` | Projection | No | Yes | 長 |
| `deviceBinding.bindingId` | 不必暴露完整值 | No | Yes | 長 |
| `verifiedStoreContext` | Yes | No | Yes | 跟 Binding |
| `human.userId` | Yes | No | Yes | 短 |
| `authenticated` | Yes | No | Yes | 短 |
| `role` | Yes | No | Yes | 短 / 可重解 |
| `allowedStoreCodes` | Yes | No | Yes | 短 / 可重解 |
| `sensitiveSession.active` | Yes | No | Yes | 短 |
| report rows | Read result only | No | Yes / Data Layer | request |

---

## 7. Cookie / Browser Storage 原則

### UX Preference

可由 Client 管理：

```text
preferred_store=A001
last_report=sales
sidebar_collapsed=true
```

### Store Device Binding Session

Reference 建議 Browser 只持有 opaque identifier，例如：

```text
store_device_binding=<opaque id>
```

Server 解析 Binding record 並確認：

```text
ACTIVE
not revoked
not expired (if policy exists)
```

若採 Cookie，建議等效：

```text
HttpOnly
Secure
SameSite
```

不應讓 Browser 自行宣告：

```text
isStoreDevice=true
storeCode=A001
```

### Human Session

也應由 Server 驗證獨立 Human Session / token。

Device Binding Cookie 與 Human Session Cookie 即使同屬一個 domain，也應視為不同 state semantics；Human logout 不應刪除 Device Binding。

---

## 8. State 如何變動

### BOOT / Resolve Device Binding

```text
BOOT
→ RESOLVE_DEVICE_BINDING
```

結果：

```text
DEVICE_BINDING_RESOLVED → GENERAL_MODE
DEVICE_UNBOUND          → PERSONAL_ENTRY
```

---

### First-time Store Device Binding

Client：

```text
REQUEST_DEVICE_BIND
```

Server：

```text
→ STORE_ACCOUNT_AUTH_REQUIRED
→ Google Workspace store account verification
→ STORE_ACCOUNT_AUTH_SUCCESS
→ StoreAccountResolver
→ storeCode
→ DEVICE_BINDING_CREATED
→ verifiedStoreContext
→ GENERAL_MODE
```

若 mapping 失敗：

```text
STORE_ACCOUNT_MAPPING_DENIED
→ no binding
```

---

### Human Authentication

```text
REQUEST_SENSITIVE
→ HUMAN_AUTH_REQUIRED
→ AUTH_SUCCESS
→ Human Identity
→ AuthorizationProvider
→ role + allowed_store_codes
→ SENSITIVE_MODE if guard passes
```

---

### Human Logout / Timeout

```text
HUMAN_LOGOUT / IDLE_TIMEOUT
→ clear Human Identity
→ clear Authorization
→ clear Sensitive Session
→ KEEP Device Binding
→ if bound: GENERAL_MODE
→ if unbound: PERSONAL_ENTRY
```

---

### Device Unbind

必須是另一個 event：

```text
UNBIND_DEVICE
→ revoke / remove Device Binding
→ verifiedStoreContext=null
```

此事件的 Production 授權策略仍屬 TBD，不應由一般 Human Logout 暗中觸發。

---

## 9. 「同一 Google 帳號」不代表同一 State

即使最後出現：

```text
Store Binding Google Account
=
Human Login Google Account
```

兩次驗證仍有不同 purpose：

```text
Binding Ceremony
→ 建立 Store Device Binding

Human Ceremony
→ 建立 Human Sensitive Session
```

因此 state lifecycle 不能合併。

另外，如果該 account 是多人共用門市帳號，它無法唯一證明自然人；若業務要求 person-level ACL，Human Ceremony 仍需取得唯一 `userId`。

---

## 10. Reference Production Flow

```text
                 ┌──────────────────────────┐
                 │ Browser / Web App        │
                 │ interaction / requests   │
                 └────────────┬─────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────┐
│ Server / BFF / Session                              │
│                                                      │
│ Store Device Binding        Human Sensitive Session │
│ bindingId                    userId                  │
│ verifiedStoreContext        role                    │
│                              allowedStores           │
│                              expiry                  │
└─────────────────────────┬────────────────────────────┘
                          │
                          ▼
             ┌──────────────────────────┐
             │ Data / BI Layer          │
             │ final row access guard   │
             └──────────────────────────┘
```

---

## 11. Sample 與 Production 的差異

GitHub Pages Sample 是純靜態網站，因此 Device Binding / Human Session 都只能 Mock 在 Browser。

Sample 的目的，是讓 PIC 看見兩個 state domain 的**語意與生命週期**：

```text
Mock Device Binding
Mock Human Session
Mock Authorization
```

Production 必須把可信 state ownership 移到 Server。

詳細 Device Binding 規格：`docs/07-store-device-binding-v0.3.md`
