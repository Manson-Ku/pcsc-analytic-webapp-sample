# Report / Data Integration Boundary v0.1

## 文件目的

本 Repo 可以把「一般報表」與「機敏報表」做成可操作、可理解的 Mock Sample，但不替 PCSC / PIC 完成正式 BigQuery RLS 或 Looker Studio 權限架構。

Reference Sample 的責任是把 Web App 需要交給資料 / BI 層的業務 Context 定義清楚。

---

## 1. Web App 負責什麼

Web App / Identity Layer 最終應能建立：

```json
{
  "store_context": "A001",
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

這些欄位回答：

```text
現在是哪一家門市 Context？
現在是誰？
這個人被授權哪些門市？
目前想看哪一家門市？
```

---

## 2. Mock Sample 如何呈現 Report

本 Repo 的報表資料全部是 Mock Data。

用途只是讓需求單位與工程團隊可以實際走一次：

```text
A店一般報表
→ 點進階報表
→ 王店長登入
→ allowedStores=[A001,B001]
→ 預設 A001
→ 切換 B001
→ Timeout
→ 回 A店一般報表
```

因此 Sample 中看到的：

- 來客指標
- 營運狀態
- 營收達成率
- 區域排名

均不代表任何正式 PCSC 數據。

---

## 3. 正式 BigQuery / BI 層責任

正式落地時，實作團隊應自行把 Identity / Authorization Context 與既有資料平台整合。

可能包含：

```text
Web App Identity / Session
        ↓
Server-side authorization check
        ↓
BigQuery RLS / Authorized View / 既有資料權限模型
        ↓
Looker Studio 或其他 BI Presentation Layer
```

本 Reference Spec 不強制指定 BigQuery 權限策略一定採哪一種形式，但必須滿足同一個 Business Rule：

> 使用者只能取得其 `allowed_store_codes` 範圍內的機敏資料。

---

## 4. Looker Studio Integration Boundary

若正式機敏報表由 Looker Studio 呈現，PIC / 實作團隊需負責確認：

1. Looker Studio 如何取得可信任的使用者 / 門市授權 Context。
2. 如何避免只靠前端 URL parameter 或 hidden filter 當作真正的資料權限控制。
3. BigQuery 端是否已在資料來源層限制使用者能讀取的 row scope。
4. Web App 中的 `selected_store_code` 如何安全地映射到報表目前查看門市。
5. Session logout / timeout 後，如何確保機敏報表不再可繼續使用舊的個人授權狀態。

Reference Sample 只定義預期行為，不替正式環境選定 embedding / token / credential 技術。

---

## 5. 重要安全邊界

錯誤做法：

```text
前端下拉選 A001
→ iframe URL 加 ?store=A001
→ 視為有 A001 權限
```

或：

```text
UI 不顯示 B001
→ 視為使用者不能讀 B001
```

這些都只是 UX，不是 Authorization。

正式資料層仍需做到：

```text
requestedStore in allowedStores
```

並在受信任的 server / data layer 驗證。

---

## 6. 責任分界

### 本 Sample / 規格負責

```text
Business Scenario
Login / Authorization State Machine
Store Context
Human Identity Contract
Allowed Stores Contract
Selected Store UX
Mock Report UI
Timeout Behavior
```

### PIC / PCSC 正式實作團隊負責

```text
Google Workspace / SSO
AOM / Employee / Store Mapping
Production Session / Token
BigQuery RLS / Data Authorization
Looker Studio Data Source / Report Integration
Production Audit / Logging
Device Trust / MDM（若需要）
```

這個分界的目的，是讓業務場景與技術規格可以先被確認，而不必等待所有正式企業基礎設施細節完成。
