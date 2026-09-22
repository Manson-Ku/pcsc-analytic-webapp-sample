# 開發者快速導讀 v0.4

## 1. 先記住兩條線

```text
Web
Device Binding → Store Context

GDS
Google Account → GDS Viewer → BigQuery RLS
```

不要再把兩條線揉成一個大型 State Machine。

## 2. Device Binding 不要求 Google

建立 Binding 的必要條件：

```text
可信流程
→ resolve storeCode
→ Server 建立 Device Binding
```

如果 native Web account 已能做到，就不需要 Google OAuth。

## 3. Google 仍可能出現在 GDS

Device Binding 不需要 Google，不等於所有 GDS 都不需要 Google。

```text
GENERAL_PUBLIC
→ 無 Google viewer login
→ Owner / Service Account credentials
→ 只能放真正可公開資料

GENERAL_RESTRICTED
→ Google viewer login
→ Owner / Service Account credentials
→ report-level gate

ANALYTICS_RLS
→ Google viewer login
→ Viewer's Credentials
→ BigQuery SESSION_USER()
→ RLS
```

## 4. GitHub Pages 不嵌真實 Report

說明頁只需要展示：

- 哪個情境會載入哪一種 GDS Report
- Sharing / Embedding / Credentials / RLS 要怎麼設定
- 哪些已驗證、哪些尚未驗證

不需要把真實 PCSC / 測試 GDS Report 放進公開 Repo。

## 5. 下一個 POC

```text
Google Account A
→ GDS ANALYTICS_RLS
→ BigQuery SESSION_USER() = A
→ 只看到 A rows
```

再換 Account B 測同一份 Report。

## 6. 目前不要再研究

```text
Web ↔ iframe postMessage
cookie 名稱
u/0 ↔ email 永久 mapping
Web 把 OAuth token 傳給 GDS
```