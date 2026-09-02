# PCSC Analytic Web App｜Executable Reference Specification v0.3

Status: `REFERENCE / REVIEW`  
Type: `Executable Requirement Specification`  
SSOT: 本文件定義業務需求、驗收場景、Device Binding、State Ownership 與責任邊界；`sample/` 是可操作示範；`docs/` 保存詳細規格。

> 本規格不是 Production IAM、BigQuery RLS 或 Looker Studio 實作方案。它的目的，是把分析團隊的業務場景翻譯成 PIC / 開發團隊可以實作與驗收的明確 Contract。

---

## 1. 問題定義

系統存在兩種不同的持續狀態：

```text
Store Device Binding
= 這個 Browser / Device 是否已被綁定為某一家門市入口

Human Sensitive Session
= 現在操作機敏報表的人是誰、能看哪些門市
```

因此系統不得只用單一：

```text
logged_in=true/false
```

正式模型至少必須分離：

```text
Device Binding
Store Context
Human Identity
Authorization
Selected Store
```

---

## 2. Store Device Binding｜正式決議

### BR-00｜門市裝置以門市 Google Workspace 帳號完成綁定

本 Reference Spec 的明確作法：

```text
首次綁定
→ 使用門市 Google Workspace 帳號完成驗證
→ Google Identity map 到唯一 storeCode
→ Server 建立 Device Binding
```

例如：

```text
store-a@...
→ A001
→ DEVICE-BIND-001
```

Google 登入只是建立 Binding 的 Authentication Ceremony；**Google login session 不等於 Device Binding 本身**。

綁定成功後，後續 App BOOT 應由 Server 驗證既有 Device Binding 並解析 Store Context，不要求每次進站重新登入門市 Google 帳號。

### BR-00A｜Device Binding 是獨立、較長生命週期的 Server State

Production 應保存等效狀態：

```json
{
  "device_binding": {
    "binding_id": "DEVICE-BIND-001",
    "status": "ACTIVE",
    "store_code": "A001"
  }
}
```

Browser 建議只持有 opaque binding/session identifier，由 Server 驗證。

### BR-00B｜Human Logout 不解除 Device Binding

正式 invariant：

```text
logoutHuman() != unbindDevice()
IDLE_TIMEOUT != unbindDevice()
```

只有獨立、明確的：

```text
UNBIND_DEVICE
```

才會撤銷 / 移除門市 Device Binding。

詳細規格：`docs/07-store-device-binding-v0.3.md`

---

## 3. Business Requirements

### BR-01｜一般門市報表不要求個人登入

若 Server 解析到有效 Device Binding：

```text
Device Binding = A001
→ verified Store Context = A001
→ A001 General Mode
```

門市員工不需要每人登入個人帳號即可查看 A 店一般報表。

### BR-02｜機敏報表要求 Human Identity

進入機敏報表前，必須另外建立 Human Session。

Device Binding / Store Context 本身不得授予 Human Sensitive Authorization。

### BR-03｜Human Identity 與 Authorization 分離

公司帳號驗證成功只代表知道「現在是誰」，不等於可以看任意門市。

系統仍需解析：

```text
user_id
→ role
→ allowed_store_codes[]
```

### BR-04｜可查看門市由 Human Authorization 決定

店長 / 區顧問可以查看哪些門市，由其 `allowed_store_codes` 決定，而不是：

```text
Device Binding 所屬門市
實體所在門市
目前使用哪一台裝置
```

### BR-05｜已綁定門市只影響預設 UX

若：

```text
Device Binding=A001
Allowed Stores=[A001,B001]
```

登入機敏模式後可以預設：

```text
Selected Store=A001
```

但仍可切換 B001。

### BR-06｜未綁定裝置仍可直接走 Human Flow

如果沒有 Device Binding，例如手機、公司筆電、家中電腦或尚未完成門市綁定的新裝置，仍可以：

```text
Human Login
→ Authorization
→ Sensitive Mode
```

只是沒有 General Store Context。

### BR-07｜Human Timeout 只退出 Human Session

已綁定 A 店的裝置：

```text
Before
Device Binding=A001
Human=USER-001
Allowed Stores=[A001,B001]
Sensitive Session=ACTIVE

IDLE_TIMEOUT / HUMAN_LOGOUT

After
Device Binding=A001       KEEP
Store Context=A001         KEEP
Human=null                 CLEAR
Authorization=[]           CLEAR
Sensitive Session=OFF      CLEAR
View=A001 General Mode
```

### BR-08｜Selected Store 不等於資料權限

正式資料層必須再次驗證：

```text
requested_store_code ∈ allowed_store_codes
```

前端下拉、URL parameter、hidden filter、Looker Studio filter 均不是 Authorization。

---

## 4. Core Invariants

```text
Device Binding != Google Login Session
Device Binding != Human Identity
Store Context != Human Identity
Human Identity != Authorization
Authorization != Selected Store

Device Binding grants Store Context only.
Device Binding does NOT grant Human sensitive authorization.

logoutHuman() != unbindDevice()
IDLE_TIMEOUT != unbindDevice()

Selected Store must be inside Allowed Stores for sensitive data access.
SSO success does not imply report authorization.
UI filtering does not replace data-layer authorization.
```

---

## 5. State Machine / Runtime Model

### 5.1 Device Binding Flow

```text
BOOT
→ RESOLVE_DEVICE_BINDING

ACTIVE Binding
→ STORE_CONTEXT_RESOLVED
→ GENERAL_MODE

No Binding
→ DEVICE_UNBOUND / PERSONAL_ENTRY
```

首次綁定：

```text
REQUEST_DEVICE_BIND
→ STORE_ACCOUNT_AUTH_REQUIRED
→ Google Workspace Store Account Auth
→ STORE_ACCOUNT_AUTH_SUCCESS
→ StoreAccountResolver
→ storeCode
→ DEVICE_BINDING_CREATED
→ GENERAL_MODE
```

解除綁定：

```text
UNBIND_DEVICE
→ Device Binding revoked / removed
→ Store Context none
```

### 5.2 Human Sensitive Flow

```text
REQUEST_SENSITIVE
→ HUMAN_AUTH_REQUIRED
→ AUTH_SUCCESS
→ HUMAN_AUTHENTICATED
→ AuthorizationProvider
→ role + allowed stores
→ AUTHORIZATION_RESOLVED
→ ENTER_SENSITIVE [guard]
→ SENSITIVE_MODE
```

### 5.3 Human Logout / Timeout

```text
HUMAN_LOGOUT / IDLE_TIMEOUT
→ clear Human Session
→ clear Authorization
→ clear Sensitive Session
→ KEEP Device Binding
```

詳細：`docs/06-state-ownership-runtime-v0.2.md`

---

## 6. Production State Ownership

```text
Browser / Web App
────────────────────────
Client Interaction State
- requestedView
- selectedStoreCode
- UI preference
- request bind / unbind action
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
Trusted Data / BI Layer
────────────────────────
Final Enforcement
- requestedStore in allowedStores
- BigQuery RLS / Authorized View / ACL
- Looker Studio presentation
```

核心原則：

> **Client owns interaction state; Server owns Device Binding, identity and authorization truth; Data layer owns final row-access enforcement.**

### Cookie / Session 原則

UX preference 可以由 Client 修改。

Device Binding / Human Security Session 不應由 Browser 直接宣告：

```text
isStoreDevice=true
storeCode=A001
role=STORE_MANAGER
allowedStores=A001,B001
```

建議 Browser 僅持有 opaque identifier，Server 驗證其對應狀態；若使用 Cookie，建議符合等效：

```text
HttpOnly
Secure
SameSite
```

---

## 7. 「店長帳號 = 門市帳號」的處理原則

即使正式環境最後發生：

```text
店長 Human Login 使用的 Google account
=
門市 Device Binding 使用的 Google account
```

兩次驗證仍屬不同 purpose：

```text
Store Binding Ceremony
→ 建立 / 驗證 Device Binding

Human Ceremony
→ 建立 Human Sensitive Session
```

所以：

```text
店長退出 Human Session
不等於
解除門市 Device Binding
```

但另有一個必須由 PIC / 業務確認的問題：

> 如果該 Google 帳號是多人共用門市帳號，它無法唯一證明是哪一位自然人。

若機敏權限要求：

```text
person → role → allowed stores
```

則 Human Ceremony 仍需取得唯一 `userId`；可以來自個人 Workspace 帳號或另一個個人二階段驗證方式。

這個問題不影響 Device Binding 與 Human Session 必須分離的決策。

---

## 8. Acceptance Scenarios

### AC-00｜首次綁定 A 店門市裝置

Given：裝置沒有 Device Binding  
When：使用 A 店門市 Google 帳號完成綁定  
Then：

```text
Device Binding=ACTIVE
storeCode=A001
Store Context=A001
Human=anonymous
View=A001 General Mode
```

### AC-01｜已綁定 A 店裝置再次進站

Given：已有有效 A001 Device Binding  
When：Web App BOOT  
Then：

```text
Server resolve Binding
→ Store Context=A001
→ A001 General Mode
```

不要求個人 Human Login。

### AC-02｜王店長在已綁定 A 店裝置進入機敏報表

```text
王店長
role=STORE_MANAGER
allowedStores=[A001,B001]
```

Then：

```text
Device Binding=A001
Human=USER-001
Allowed Stores=[A001,B001]
Selected Store default=A001
Sensitive Mode=allowed
```

### AC-03｜王店長跨店查看

可以切 B001；不得取得 C001 / D001 機敏資料。

### AC-04｜未綁定裝置直接個人登入

例如手機 / 公司筆電 / 家中電腦：

```text
Device Binding=NONE
→ Human Login
→ Authorization
→ Sensitive Mode
```

### AC-05｜Human 登入成功但無 Authorization

```text
Human authenticated
Allowed Stores=[]
→ AUTHORIZATION_DENIED
```

### AC-06｜Human Timeout 不解綁

Given：

```text
Device Binding=A001
Human=USER-001
```

When：Timeout  
Then：

```text
Human cleared
Authorization cleared
Device Binding still A001
Store Context still A001
→ A001 General Mode
```

### AC-07｜明確解除門市綁定

When：執行 `UNBIND_DEVICE`  
Then：

```text
Device Binding=NONE / REVOKED
Store Context=none
```

Human Logout 不得產生同樣效果。

### AC-08｜非法 Selected Store

Given：Allowed Stores=[A001,B001]  
When：request C001  
Then：正式 Server / Data Layer 必須拒絕。

---

## 9. Reference Context Contract

正式資料 / BI request 前，系統需要能形成等效 Context：

```json
{
  "device_binding": {
    "status": "ACTIVE",
    "binding_id": "DEVICE-BIND-001",
    "store_code": "A001"
  },
  "store_context": {
    "store_code": "A001",
    "verified": true
  },
  "human": {
    "user_id": "USER-001",
    "email": "manager.wang@example.com"
  },
  "authorization": {
    "role": "STORE_MANAGER",
    "allowed_store_codes": ["A001", "B001"]
  },
  "selected_store_code": "A001"
}
```

欄位名稱可以調整；語意不可消失。

---

## 10. Adapter Contracts

Reference 需要四個主要能力：

```text
StoreAccountResolver
StoreDeviceBindingProvider
HumanIdentityProvider
AuthorizationProvider
```

詳細：`docs/03-adapter-contract-v0.1.md`

---

## 11. Report / Data Boundary

### Reference Sample / MARPTEK Translation Layer

```text
Business Scenario
Device Binding semantics
Login / Authorization State Machine
State Ownership / Runtime Contract
Store Context
Human Identity Contract
Allowed Stores Contract
Selected Store UX
Mock Report UI
Timeout Behavior
Acceptance Scenarios
```

### PIC / PCSC Production Implementation

```text
Google Workspace / Enterprise SSO
Store Google Account → storeCode mapping SSOT
Production Device Binding persistence / revocation
Production Human Session
AOM / Employee / Store Authorization mapping
Server-side authorization
BigQuery RLS / Authorized View / existing ACL
Looker Studio Integration
Audit / Logging
Optional MDM / Device Trust hardening
```

---

## 12. Open Integration Facts / TBD

目前已決定「如何建立門市身分」；剩下是 Production implementation facts：

```text
A01 門市 Google 帳號 → storeCode mapping SSOT
A02 Person-level unique userId 的來源
A03 user → role → allowed stores SSOT
A04 可沿用的 Google Workspace / SSO 介面
A05 Device Binding persistence scope：Browser / OS device / managed device
A06 Binding TTL / rotation / revoke policy
A07 UNBIND_DEVICE 的 Production 權限與操作方式
A08 Human idle timeout 時間
A09 BQ / Looker 正式 Enforcement 架構
A10 若店長 Human Account 與共享門市帳號相同，如何取得唯一自然人 identity
A11 是否另加 MDM / Endpoint 作 Device Trust hardening
```

詳細：`docs/04-assumption-register-v0.1.md`

---

## 13. Spec Governance

```text
1. SPEC.md
   = Business / Acceptance SSOT

2. sample/
   = Executable behavior reference

3. docs/
   = Detailed architecture / contract / assumption notes

4. Production code
   = PIC / implementation team
```

若 Sample 與 `SPEC.md` 不一致，先確認需求，再同步修正 Sample；不得默認 Sample code 自動成為新的業務規則。

---

## 14. Version

```text
Spec Version: v0.3
Major addition: Store Google Account based Device Binding
Maturity: Reference / Review
Production Ready: NO
```
