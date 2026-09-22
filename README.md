# PCSC Analytic Web App Reference

目前版本：**v0.4 — Simplified Web State + GDS Access Architecture**

這個 Repo 已從原本大型 Web App State Machine，收斂成兩條獨立責任鏈：

```text
A. Web App State
   Device Binding → Store Context → General Surface

B. GDS Access
   Google Account → GDS Viewer → BigQuery SESSION_USER() → RLS
```

核心決議：

- **Device Binding 不再綁死 Google Auth。**
- Web native account、Enterprise SSO、Google Workspace 或其他可信 Server Flow，只要能 resolve `storeCode`，都可以建立 Device Binding。
- Web 不再為 GDS 重複維護 Human Identity、Allowed Stores、Sensitive Session。
- GDS viewer 由 Browser 的 Google Session 決定。
- 需要 row-level authorization 的報表，交給 BigQuery IAM + RLS。
- GitHub Pages 後續只說明「此情境應嵌入哪一種 GDS Report，以及 Report 如何設定」，不需要真的嵌入測試 Report。

## 30 秒架構

### Web Device Binding

```text
BOOT
↓
Resolve Device Binding
├─ ACTIVE → Store Context → General Surface
└─ NONE   → Binding Required

Trusted Web Auth / Server Flow
→ resolve storeCode
→ create Device Binding
```

Google Workspace Login 可以是一種 Binding Ceremony，但**不是必要條件**。

### GDS Analytics

```text
User opens Analytics
↓
Restricted GDS
↓
Browser Google Session
↓
GDS Viewer
↓
Data Source = Viewer's Credentials
↓
BigQuery SESSION_USER()
↓
Row Access Policy
```

Web App 不需要把自己的 user/token 傳進 GDS iframe。

## GDS Report Profiles

### GENERAL_PUBLIC

只適用於真正可公開的資料。

```text
Sharing: Public / Anyone with link
Embedding: Enabled
Google viewer login: No
Data credentials: Owner's Credentials / Service Account
BigQuery RLS: No
```

Web Device Binding 不能保護一份本身可以直接開啟的 public GDS Report。

### GENERAL_RESTRICTED

一般報表仍需要 Google gate，但不需要 per-viewer row scope。

```text
Sharing: Restricted / Workspace
Embedding: Enabled
Google viewer login: Yes
Data credentials: Owner's Credentials / Service Account
BigQuery RLS: Optional
```

這裡的 Google Auth 是 **GDS access policy**，不是 Device Binding。

### ANALYTICS_RLS

進階 / 機敏分析的主要研究路線。

```text
Sharing: Restricted
Embedding: Enabled
Google viewer login: Yes
Data credentials: Viewer's Credentials
BigQuery viewer IAM: Required
BigQuery RLS: Required
RLS identity: SESSION_USER()
```

## 2026-09-22 實驗結果

```text
[PASS] Restricted GDS 可嵌入 Web
[PASS] GDS viewer identity 來自 Browser Google session
[PASS] 多 Google Account 時會出現 account selector
[PASS] Network 可觀察到 /embed/u/0/、/embed/u/1/
[PASS] 同頁分別使用 /u/0/、/u/1/ 有效
[OBSERVED] 第三方 Cookie 被阻擋時 embedded auth 失敗

[TODO] GDS Viewer's Credentials → BigQuery SESSION_USER()
[TODO] SESSION_USER() → BigQuery Row Access Policy
```

研究停止點：不再深入 cookie / iframe slot mapping；下一階段只驗證 **GDS Google Viewer → BigQuery SESSION_USER() → RLS**。

## 文件

- [`SPEC.md`](./SPEC.md) — v0.4 SSOT
- [`docs/00-developer-quickstart-v0.4.md`](./docs/00-developer-quickstart-v0.4.md)
- [`docs/01-web-device-binding-v0.4.md`](./docs/01-web-device-binding-v0.4.md)
- [`docs/02-gds-report-profiles-v0.1.md`](./docs/02-gds-report-profiles-v0.1.md)
- [`docs/03-gds-bq-rls-v0.1.md`](./docs/03-gds-bq-rls-v0.1.md)
- [`docs/04-experiment-log-2026-09-22.md`](./docs/04-experiment-log-2026-09-22.md)

舊 v0.1–v0.3 文件已被 v0.4 supersede，暫時保留供歷史比對；**不得再作為正式實作依據**。

## Production 目前要回答的問題

```text
1. Web native account / trusted flow 如何 resolve storeCode？
2. Device Binding 存哪裡、如何 revoke / expire？
3. 一般報表屬於 GENERAL_PUBLIC 還是 GENERAL_RESTRICTED？
4. 進階分析是否採 Viewer's Credentials？
5. GDS viewer 到 BigQuery 後，SESSION_USER() 是否等於該 Google Account？
6. PCSC Workspace users 需要哪些最小 BigQuery IAM？
7. RLS mapping 用 email、group、mapping table，或其他正式 SSOT？
```

如果未來 Web App 自己新增 GDS 以外的機敏 API、下載或管理操作，再獨立設計 Web Human Authorization；不要預先塞回目前的最小 State Machine。