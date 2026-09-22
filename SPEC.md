# PCSC Analytic Web App｜Reference Specification v0.4

Status: `REFERENCE / POC`  
Date: `2026-09-22`

## 1. 核心決議

v0.4 將原本過度耦合的狀態模型拆成兩條獨立責任鏈：

```text
Web App State
Device Binding → Store Context → General Surface

GDS Access
Google Account → GDS Viewer → BigQuery → RLS
```

除非 Web 本身另有需要 person-level authorization 的功能，否則不再把 Human Session、Allowed Stores、Sensitive Timeout 等狀態放進 Web App 主 State Machine。

## 2. Web Device Binding

### BR-01｜Device Binding 不依賴 Google Auth

Device Binding 的目的只有：

```text
這個 Browser / Device
→ 被可信地綁定到哪個 storeCode
```

建立 Binding 時需要的是可信的 Store Resolution，不是特定 IdP。

可行來源：Web native account、Enterprise SSO、Google Workspace、Admin provisioning 或其他可信 server-side flow。

如果 Web native account 已能可信 resolve `web session → STORE_A`，就可以直接建立 `Device Binding → STORE_A`。

### BR-02｜Binding 是 Server-side truth

正式環境至少要有等效狀態：

```json
{
  "binding_id": "opaque-id",
  "status": "ACTIVE",
  "store_code": "A001"
}
```

Browser 只持 opaque identifier / session；不可把可修改的 `storeCode` 當成正式權限。

### BR-03｜Web State 最小化

Web Runtime 最少只需要：

```text
Device Binding
Store Context
Current View = GENERAL | ANALYTICS
```

不再要求 Web 為 GDS 建立 Human Identity、Human Authorization、Allowed Stores、Sensitive Session、Human Timeout。

## 3. GDS Access 與 Web State 分離

### BR-04｜Web 不把 user/token 傳給 GDS

已實測的身份來源：

```text
Browser Google Session
→ embedded GDS
→ GDS Viewer
```

不是 `Web Session → iframe token transfer → GDS Viewer`。

因此 Web 只決定「此刻要呈現哪一類 Report Surface」，不需要充當 GDS 的 IdP。

### BR-05｜GDS Report Profile 由資料敏感度決定

#### GENERAL_PUBLIC

```text
Sharing: Public / Anyone with link
Embedding: Enabled
Credentials: Owner / Service Account
Google Login: No
RLS: No
```

只適合真正可公開資料；Web Device Binding 不能保護 public report。

#### GENERAL_RESTRICTED

```text
Sharing: Restricted / Workspace
Embedding: Enabled
Credentials: Owner / Service Account
Google Login: Yes
RLS: Optional
```

Google Auth 此時只是 GDS access policy，與 Device Binding 無關。

#### ANALYTICS_RLS

```text
Sharing: Restricted
Embedding: Enabled
Google Login: Yes
Credentials: Viewer's Credentials
BigQuery IAM: Required
RLS: Required
Identity: SESSION_USER()
```

## 4. BigQuery RLS

### BR-06｜RLS identity 來自 query principal

POC 要驗證：

```text
GDS Viewer A
→ Viewer's Credentials
→ BigQuery SESSION_USER() = A
```

再由 Row Access Policy 做 row scope，例如 `viewer_email = SESSION_USER()`。

### BR-07｜IAM 與 RLS 是兩層

```text
IAM = 這個 viewer 能不能 query
RLS = query 之後能看到哪些 rows
```

RLS 不取代 IAM。

## 5. 最小情境

### Scenario A｜已綁定門市裝置

```text
BOOT → resolve Binding=A001 → Store Context=A001 → GENERAL
```

一般資料真正可公開 → `GENERAL_PUBLIC`；仍需 Google gate → `GENERAL_RESTRICTED`。

### Scenario B｜進入進階分析

```text
GENERAL
→ user opens Analytics
→ ANALYTICS surface
→ ANALYTICS_RLS
→ Google handles viewer
→ BigQuery RLS handles row scope
```

### Scenario C｜尚未綁定裝置

```text
BOOT
→ Binding NONE
→ Web native login / trusted binding ceremony
→ resolve storeCode
→ create Binding
→ GENERAL
```

這個流程不要求 Google Auth。

## 6. Invariants

```text
Device Binding != Google Login Session
Device Binding != GDS Viewer
Store Context != GDS Viewer

Google Auth is optional for Device Binding.
Google Auth may still be required by the selected GDS Report Profile.

Web selected store / URL / iframe path != data security boundary.
u/0 and u/1 are browser multi-login slots, not stable identity.

If a public report contains sensitive data, Web Device Binding cannot make it private.

For ANALYTICS_RLS:
GDS Viewer → BigQuery IAM → SESSION_USER() → RLS
```

## 7. Out of Scope

v0.4 不處理：Web 自己的 person-level sensitive API authorization、Google multi-login slot mapping、強制 Web-bound account 與 GDS viewer account 一致、真實 GDS iframe 內嵌、正式 PCSC IAM provisioning。

若未來 Web 本身新增機敏 API，再獨立設計 Web Human Authorization；不要預先塞回目前的最小 State Machine。