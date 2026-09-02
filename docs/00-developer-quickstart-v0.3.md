# 開發者快速導讀 v0.3

這份文件給第一次接觸此專案的 PIC / 開發人員。

目標不是要求先讀完整份規格，而是在 5 分鐘內回答：

1. 這個系統到底要解什麼問題？
2. 哪些 State 在 Browser，哪些必須由 Server 當 SSOT？
3. Mock Sample 正式落地時要替換哪些介面？
4. 哪些 Business Invariant 不可因實作方式不同而改掉？

---

## 1. 30 秒版本

系統同時存在兩種不同生命週期：

```text
Store Device Binding
= 這個 Browser / Device 被綁定成哪一家門市
= 長生命週期

Human Session
= 現在正在操作機敏報表的人是誰
= 短生命週期
```

門市 Device Binding 的明確作法：

```text
門市 Google Workspace 帳號驗證
→ StoreAccountResolver
→ storeCode
→ Server 建立 Device Binding
→ 之後 BOOT 可解析 verified Store Context
```

Human Login 另外處理：

```text
Human Identity
→ userId
→ AuthorizationProvider
→ role + allowedStoreCodes
```

因此：

```text
logoutHuman() != unbindDevice()
IDLE_TIMEOUT != unbindDevice()
```

---

## 2. 五個最重要的 Context / State

| 名稱 | 問題 | 正式 SSOT | Client 可以自行改嗎？ |
|---|---|---|---|
| `Device Binding` | 這個 Browser / Device 綁定哪家店？ | Server | No |
| `Store Context` | 目前一般報表是哪家店？ | Server，由 Binding 解析 | No |
| `Human Identity` | 現在操作的人是誰？ | Enterprise SSO / Server Session | No |
| `Authorization` | 這個人可以看哪些店？ | Authorization SSOT / Server | No |
| `Selected Store` | 使用者現在想看哪家店？ | Client interaction state | Yes，但 Server 必須驗證 |

一句話：

> Client 可以選擇想看哪裡；Server 才能決定有沒有權限看。

---

## 3. State Ownership

```text
Browser / Web App
────────────────────────
Client Interaction State
- requestedView
- selectedStoreCode
- UI preference
- request bind / unbind
        │
        ▼
Server / BFF / Session Layer
────────────────────────
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
────────────────────────
Final Enforcement
- requestedStoreCode in allowedStoreCodes
- BigQuery RLS / Authorized View / ACL
- Looker Studio presentation
```

核心原則：

> **Client owns interaction state; Server owns Device Binding, identity and authorization truth; Data layer owns final row-access enforcement.**

---

## 4. Mock → Production Replacement Map

Sample 目前全部是 Browser Mock；正式開發不需要照搬 Mock implementation，只要維持 Contract。

| Sample / Contract | 正式要回答的問題 | Production 可能來源 | 必要輸出 |
|---|---|---|---|
| `StoreAccountResolver` | 這個門市 Google Account 是哪家店？ | GWS / AOM / PCSC mapping | `storeCode` |
| `StoreDeviceBindingProvider` | 此 Browser / Device 是否已有有效門市綁定？ | Server Session / Binding Store | `bindingId`, `status`, `storeCode` |
| `HumanIdentityProvider` | 現在人是誰？ | Google Workspace SSO / Enterprise IdP | stable `userId` |
| `AuthorizationProvider` | 這個人可看哪些店？ | AOM / HR / ACL SSOT | `role`, `allowedStoreCodes[]` |
| Sensitive Data Guard | 這次真的能讀這家店嗎？ | Trusted API / BQ RLS / Authorized View | allow / deny / row scope |

不要把上述企業來源硬寫進每個 UI Component；應集中在 Adapter / Server Layer。

---

## 5. 最小 Event Flow

### 已綁定門市裝置

```text
BOOT
→ resolve Device Binding
→ DEVICE_BINDING_RESOLVED(A001)
→ GENERAL_MODE(A001)

REQUEST_SENSITIVE
→ HUMAN_AUTH_REQUIRED
→ AUTH_SUCCESS(USER-001)
→ AUTHORIZATION_RESOLVED([A001,B001])
→ ENTER_SENSITIVE(A001)

CHANGE_STORE(B001)
→ Client selectedStoreCode=B001
→ Server/Data Guard validates B001 in allowedStoreCodes

HUMAN_LOGOUT / IDLE_TIMEOUT
→ clear Human Session
→ clear Authorization
→ KEEP Device Binding=A001
→ GENERAL_MODE(A001)
```

### 尚未綁定裝置

```text
BOOT
→ DEVICE_UNBOUND

Option A:
REQUEST_DEVICE_BIND
→ Google Workspace store-account verification
→ store account → storeCode
→ create Device Binding
→ GENERAL_MODE

Option B:
不綁定裝置
→ Human Login
→ Authorization
→ Sensitive Mode
```

---

## 6. Store Google Account 和 Human Account 可能相同，但語意不同

即使正式環境最後出現：

```text
店長 Google Account = 門市 Google Account
```

也必須把兩個動作視為不同 ceremony：

```text
Store Binding Ceremony
目的：建立 / 驗證 Device Binding

Human Authentication Ceremony
目的：建立 Human Session
```

因此 Human Logout 不得順便刪除 Device Binding。

另外，如果該帳號其實是多人共用門市帳號，它不能單獨證明自然人身分；person-level Authorization 仍需要唯一 `userId` 的來源。

---

## 7. Production 不可用的捷徑

以下都只能當 UX，不能當 Security Boundary：

```text
URL ?store=A001
Client selectedStoreCode
hidden menu
disabled option
Looker Studio filter
Browser localStorage
可修改 cookie 裡的 role / allowedStores
```

正式資料請求至少要滿足等效 Guard：

```text
requestedStoreCode in server-resolved allowedStoreCodes
```

---

## 8. 建議開發者閱讀順序

```text
1. sample/                         先操作，理解場景
2. 本文件                          5 分鐘理解架構
3. SPEC.md                         Business / Acceptance SSOT
4. docs/07-store-device-binding-v0.3.md
5. docs/06-state-ownership-runtime-v0.2.md
6. docs/03-adapter-contract-v0.1.md
7. docs/05-report-data-boundary-v0.1.md
```

如果正式既有架構與 Sample 技術形式不同，不需要重做成 Sample 的樣子；只要確認 Business Invariant、State Ownership、Adapter Contract 與 Acceptance Criteria 仍成立。

---

## 9. PIC 接手時最需要回答的 5 個問題

```text
1. 門市 Google Account → storeCode 的正式 SSOT 在哪？
2. Device Binding 要儲存在哪一層、如何 revoke / rotate？
3. Human SSO 如何取得唯一 stable userId？
4. userId → role → allowedStoreCodes 的正式 SSOT 在哪？
5. requestedStoreCode ∈ allowedStoreCodes 最終在哪個 Server / Data Layer enforce？
```

這 5 題回答完成後，主要整合點就已經明確。