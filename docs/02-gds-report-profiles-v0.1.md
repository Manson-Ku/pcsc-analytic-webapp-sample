# GDS Report Profiles v0.1

這份文件只回答：

> 在不同 Web 情境下，應載入哪一種 GDS Report？Report 要怎麼設定？

不放真實 iframe。

## Profile A｜GENERAL_PUBLIC

### 使用情境

已完成 Device Binding，且一般報表資料被明確定義為「即使取得直接 Report URL 也不構成資料外洩」。

### Report 設定

```text
Sharing: Public / Anyone with link
Embedding: Enabled
Google viewer login: No
Data credentials: Owner's Credentials / Service Account
BigQuery RLS: No
```

### 限制

Web Device Binding 只能控制 Web UX，不能保護 public GDS URL。

```text
如果資料不能直接公開
→ 不可使用 GENERAL_PUBLIC
```

## Profile B｜GENERAL_RESTRICTED

### 使用情境

一般報表仍需要 Google 帳號 gate，但不需要每個 viewer 看到不同 row scope。

### Report 設定

```text
Sharing: Restricted to allowed Workspace/domain/users
Embedding: Enabled
Google viewer login: Yes
Data credentials: Owner's Credentials / Service Account
BigQuery RLS: Optional
```

這裡的 Google Auth 是 GDS Report Access，不是 Device Binding。

## Profile C｜ANALYTICS_RLS

### 使用情境

進階 / 機敏分析，需要同一份 Report 依 Google viewer 顯示不同資料。

### Report 設定

```text
Sharing: Restricted
Embedding: Enabled
Google viewer login: Yes
Data credentials: Viewer's Credentials
BigQuery viewer IAM: Required
BigQuery RLS: Required
RLS identity: SESSION_USER()
```

### 預期

```text
Account A
→ same report
→ SESSION_USER() = A
→ rows for A

Account B
→ same report
→ SESSION_USER() = B
→ rows for B
```

## Decision Table

| 情境 | Google Login | Credentials | BQ RLS | Report URL |
|---|---|---|---|---|
| GENERAL_PUBLIC | No | Owner / Service Account | No | 可直接開啟，因此只能放可公開資料 |
| GENERAL_RESTRICTED | Yes | Owner / Service Account | Optional | 受 Report sharing gate |
| ANALYTICS_RLS | Yes | Viewer | Yes | row scope 由 BQ 控制 |

## 不建議的混搭

### Device Binding + public GDS + URL filter 當 security

不成立。

```text
Web store=A001
→ iframe ?store=A001
```

只能算 UX routing，不能保證使用者無法改成 A002。

### ANALYTICS_RLS 使用 Owner's Credentials

如果目標是讓 `SESSION_USER()` 代表實際 GDS viewer，就不應由 Owner 代查。