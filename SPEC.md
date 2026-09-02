# PCSC Analytic Web App｜Executable Reference Specification v0.2

Status: `REFERENCE / REVIEW`  
Type: `Executable Requirement Specification`  
SSOT: 本文件定義業務需求、驗收場景、State Ownership 與責任邊界；`sample/` 是本規格的可操作示範；`docs/` 保存詳細狀態機與介面說明。

> 本規格不是 Production IAM、BigQuery RLS 或 Looker Studio 實作方案。它的目的，是把分析團隊的業務場景翻譯成 PIC / 開發團隊可以實作與驗收的明確 Contract。

---

## 1. 問題定義

分析 Web App 同時存在兩種使用情境：

1. 門市共用 WebSC / 平板需要直接顯示該門市的一般報表。
2. 店長 / 區顧問需要以個人身分查看較機敏、且可能跨多門市的報表。

因此系統不得只用單一 `logged_in=true/false` 表達權限。

正式模型必須分離：

```text
Store Context
Human Identity
Authorization
Selected Store
```

---

## 2. Business Requirements

### BR-01｜一般門市報表不要求個人登入

當系統可以解析目前 Store Context 時，門市一般報表可以直接依該門市 Context 顯示，不要求每位門市員工登入個人帳號。

### BR-02｜機敏報表要求 Human Identity

進入機敏報表前，必須另外辨識操作的人員身分。

Store Context 本身不得授予機敏資料權限。

### BR-03｜Human Identity 與 Authorization 分離

「公司帳號驗證成功」只表示知道使用者是誰，不代表此人可以查看任意門市。

系統仍需解析：

```text
user_id
→ role
→ allowed_store_codes[]
```

### BR-04｜可查看門市由 Authorization 決定

店長 / 區顧問可以查看哪些門市，取決於其 `allowed_store_codes`，而不是目前人在哪一家店、也不是目前使用哪一台裝置。

### BR-05｜Store Context 只影響預設 UX

若使用者在 A 店 WebSC 完成個人驗證，而且 A 店也位於其 Allowed Stores 內，系統可以預設 Selected Store=A。

這只是 UX default，不得縮小或擴張實際 Authorization。

### BR-06｜個人公司電腦可直接進入 Human Flow

若沒有 Store Context，例如店長 / 區顧問使用自己的公司電腦，仍可完成個人身分驗證與 Authorization 後進入機敏報表。

### BR-07｜共用裝置 Timeout 只退出 Human Session

在 WebSC / 共用門市裝置上，Human Session timeout 或人工退出後：

```text
清除 Human Identity
清除 Authorization
清除機敏資料狀態
保留 Store Context
回到該門市一般報表
```

不得把整台門市裝置的 Store Context 一併登出。

### BR-08｜Selected Store 不等於資料權限

前端下拉選單、URL parameter、hidden filter、Looker Studio filter 都不是 Authorization。

正式資料層必須再次驗證：

```text
requested_store_code ∈ allowed_store_codes
```

---

## 3. Core Invariants

以下規則應視為 implementation invariant：

```text
Store Context != Human Identity
Human Identity != Authorization
Authorization != Selected Store
Store Context does not grant sensitive access
Selected Store must be inside Allowed Stores
SSO success does not imply report authorization
UI filtering does not replace data-layer authorization
```

---

## 3A. State Machine / Ownership / Runtime Model

### 3A-01｜這裡所稱 State Machine 是什麼

State Machine 不是單一 JSON，也不是一個登入 Boolean，而是：

```text
States
+ Events
+ Transitions
+ Guards
+ Context
+ Ownership rules
```

Sample Web 右側 `State Machine Inspector` 會同步顯示目前 Runtime State、Reference Machine JSON、Ownership 與 Guard evaluation。

### 3A-02｜Production 必須拆成三層 State Responsibility

```text
Browser / Web App
────────────────────
Client Interaction State
- requestedView
- selectedStoreCode
- UI filters / UX preference
        │
        ▼
Server / BFF / Session Layer
────────────────────
Authoritative Identity / Authorization State
- verified Store Context
- Human Identity
- authentication status
- role
- allowedStoreCodes
- sensitive session / expiry
        │
        ▼
Trusted Data / BI Layer
────────────────────
Final row-access enforcement
- requestedStoreCode in allowedStoreCodes
- BigQuery RLS / Authorized View / ACL
- Looker Studio presentation
```

核心原則：

> **Client owns interaction state; Server owns identity and authorization truth; Data layer owns final row-access enforcement.**

### 3A-03｜Client 可以改什麼

Client 可以直接改：

```text
requestedView
selectedStoreCode
lastSelectedStore
UI filter
navigation state
```

也可以將非機敏 Preference 保存於：

```text
memory
sessionStorage
localStorage
non-sensitive cookie
URL route/query
```

但 Client 提出的狀態只是「想做什麼」，不是「有權做什麼」。

例如：

```text
selectedStoreCode=B001
```

語意是：

```text
Browser requests B001
```

不是：

```text
Browser is authorized for B001
```

### 3A-04｜Server 必須擁有什麼真相

以下狀態不得由 Browser 自行宣告為真：

```text
verifiedStoreContext
human.userId
authenticated
role
allowedStoreCodes
sensitiveSession.active
sensitiveSession.expiresAt
```

它們應由 Enterprise SSO、Google Workspace Identity、AOM / employee mapping、Authorization SSOT、Server Session 等可信來源建立或驗證。

### 3A-05｜Cookie 原則

UX Preference Cookie 可以由 Client 調整，例如：

```text
preferred_store=A001
last_report=sales
```

安全 Session 不應採用可被 Browser 任意修改後直接相信的：

```text
role=STORE_MANAGER
allowedStores=A001,B001
```

正式 Session 建議滿足等效安全原則：

```text
opaque session id
HttpOnly
Secure
SameSite
server validation
```

若採 signed / encrypted token，也必須由 Server 驗證完整性、有效期與撤銷邏輯。

### 3A-06｜State 如何變動

State 應由 Event 驅動：

```text
BOOT
→ STORE_CONTEXT_RESOLVED / STORE_CONTEXT_NONE

REQUEST_SENSITIVE
→ HUMAN_AUTH_REQUIRED

AUTH_SUCCESS
→ HUMAN_AUTHENTICATED

AUTHORIZATION_RESOLVED
→ AUTHORIZATION_RESOLVED state

ENTER_SENSITIVE + guard pass
→ SENSITIVE_MODE

CHANGE_STORE(B001)
→ Client selectedStoreCode=B001
→ Data request still requires server/data guard

HUMAN_LOGOUT / IDLE_TIMEOUT
→ clear Human / Authorization / Sensitive Session
→ keep verified Store Context when present
```

詳細 State Ownership / Runtime / Mutation 規格：`docs/06-state-ownership-runtime-v0.2.md`

---

## 4. Acceptance Scenarios

### AC-01｜A 店一般門市模式

Given：入口為 A 店 WebSC  
When：Web App 啟動並解析 Store Context  
Then：

```text
storeContext = A001
human = anonymous
general report = A001
```

且不要求個人登入。

### AC-02｜王店長在 A 店進入機敏報表

Mock Reference：

```text
王店長
role = STORE_MANAGER
allowedStores = [A001, B001]
```

Given：Store Context=A001  
When：王店長完成個人驗證  
Then：

```text
Human Identity = USER-001
Allowed Stores = [A001, B001]
Selected Store default = A001
Sensitive Mode = allowed
```

### AC-03｜王店長跨店查看

Given：王店長已通過 AC-02  
When：切換 Selected Store=B001  
Then：可以取得 B001 機敏報表。

王店長不得取得 C001 / D001 機敏資料。

### AC-04｜區顧問使用個人公司電腦

Mock Reference：

```text
陳區顧問
role = AREA_ADVISOR
allowedStores = [A001, B001, C001, D001]
```

Given：沒有 Store Context  
When：陳區顧問完成個人驗證  
Then：仍可進入 Sensitive Mode 並查看 Allowed Stores 內的門市。

### AC-05｜公司帳號登入成功但無報表授權

Mock Reference：

```text
未授權公司使用者
allowedStores = []
```

When：Human Identity 驗證成功  
Then：

```text
AUTHORIZATION_DENIED
Sensitive Mode = denied
```

用來驗證「SSO success != report authorization」。

### AC-06｜共用 WebSC Timeout

Given：Store Context=A001，且王店長正在 Sensitive Mode  
When：Human Session timeout  
Then：

```text
Human Identity → anonymous
Authorization → unresolved
Sensitive data → cleared
Store Context → A001 (keep)
View → A001 General Mode
```

### AC-07｜非法 Selected Store

Given：Allowed Stores=[A001, B001]  
When：請求 C001  
Then：前端可以拒絕操作，但正式實作仍必須由 trusted server / data layer 再次拒絕資料請求。

---

## 5. Reference Context Contract

Web App 在進入資料 / BI 層前，需要能形成等效於下列的可信 Context：

```json
{
  "store_context": {
    "store_code": "A001"
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

欄位名稱可以由正式實作調整；語意不可消失。

注意：Production 中這個 Context 不應被理解為「Browser 自己產生即可信」。`human` / `authorization` / verified store context 必須來自可信 Server / Enterprise Identity Layer；Browser 僅持有其可顯示的 projection。

---

## 6. Adapter Contracts

Reference Sample 將企業底層視為可插拔 Provider：

```text
StoreIdentityProvider
HumanIdentityProvider
AuthorizationProvider
```

PIC / 正式實作團隊可以使用現有 Google Workspace、SSO、AOM、員工權限資料、內部 API 或其他企業系統實作 Provider。

上層 Business State Machine 不應因底層來源不同而改寫。

詳細 Contract：`docs/03-adapter-contract-v0.1.md`

---

## 7. Report / Data Boundary

### Reference Sample 負責

```text
Business Scenario
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

### PIC / PCSC 正式實作團隊負責

```text
Google Workspace / Enterprise SSO
AOM / Employee / Store Mapping
Production Session / Token
Server-side authoritative state
Server-side authorization
BigQuery RLS / Authorized View / existing ACL
Looker Studio Data Source / Embed / Report Integration
Production Audit / Logging
Device Trust / MDM (if required)
```

詳細說明：

- `docs/05-report-data-boundary-v0.1.md`
- `docs/06-state-ownership-runtime-v0.2.md`

---

## 8. Mock Data Policy

`sample/` 中所有：

```text
人名
帳號
門市代碼
來客數
營收達成率
區域排名
營運狀態
```

均為 DEMO / MOCK DATA。

它們只用來驗證業務流程，不代表 PCSC 正式資料、帳號或授權。

---

## 9. Open Assumptions / TBD

目前不阻塞 Reference Spec 的待確認項目包括：

```text
A01 門市帳號 / 裝置如何解析唯一 store_code
A02 公司個人帳號如何解析唯一 user_id
A03 user → role → allowed stores 的正式 SSOT
A04 現有 SSO / Login 架構與可重用介面
A05 WebSC / 平板既有裝置管理能力
A06 Human Session idle timeout 正式時間
A07 BigQuery / Looker Studio 正式 Enforcement 架構
A08 Production Server Session / BFF / token 實作形式
```

詳細追蹤：`docs/04-assumption-register-v0.1.md`

---

## 10. 如何驗收本規格

### 分析 / 需求團隊

直接操作 GitHub Pages Sample，逐項確認 AC-01 ～ AC-06 的業務行為是否符合期待。

### PIC / 開發團隊

Review：

1. Core Invariants 是否可由既有技術架構滿足。
2. Client / Server / Data Layer 的 State Ownership 是否可映射到既有架構。
3. 三個 Provider 各自可以接哪個既有系統。
4. `allowed_store_codes` 應由哪個 SSOT 提供。
5. 正式資料層如何 enforce `requested_store_code ∈ allowed_store_codes`。
6. Human Session timeout 後如何確保 BI / Looker 不再沿用舊授權。
7. 哪些 Browser cookie / storage 只是 Preference，哪些 Session 必須由 Server 驗證。

---

## 11. Spec Governance

規格優先順序：

```text
1. SPEC.md                ← Business / Acceptance / Ownership SSOT
2. sample/                ← Executable behavior reference
3. docs/                  ← Detailed technical explanation
4. Production code       ← PIC / implementation team
```

若 Sample 與 `SPEC.md` 行為不一致，應先確認需求，再同步修正 Sample；不得默認 Sample code 自動成為新的業務規則。

---

## 12. Version

```text
Spec Version: v0.2
Maturity: Reference / Review
Production Ready: NO
```
