# State Storage Recommendation v0.3

## 目的

本文件只提供 **Reference Recommendation**：說明每類 State 建議放在哪一層、需要什麼 persistence 特性，以及哪些內容不能把 Browser 當成可信 SSOT。

這不是指定 Redis、SQL、Firestore 或其他產品；正式技術選型由 PIC / PCSC 既有架構決定。

核心原則：

```text
先定義 State semantics / ownership / lifetime
再選擇符合條件的 storage technology
```

---

## 1. 建議 Storage Matrix

| State / Context | 建議儲存位置 | Persistence | Browser 可以保存什麼 | Security Truth |
|---|---|---|---|---|
| `requestedView` | Browser memory / route | Ephemeral | 完整值 | No |
| `selectedStoreCode` | Browser memory；必要時 route / sessionStorage | Ephemeral / session | 完整值 | No，Server 必須驗證 |
| UX preference | localStorage / non-sensitive cookie | Optional durable | 完整值 | No |
| Store Account → `storeCode` mapping | Enterprise mapping SSOT / server-side table or service | Durable | 不建議作 SSOT | Yes |
| `Device Binding` | Durable server-side Binding Store / enterprise DB | Long-lived | opaque binding/session id | Yes |
| `verifiedStoreContext` | Server session / derived from active Device Binding | 跟 Binding | projection only | Yes |
| Human Session | Server-side Session Store 或 server-verified IdP token/session | Short-lived | opaque session id / verified token | Yes |
| `role` / `allowedStoreCodes` | Authorization SSOT；可有短 TTL server cache | Re-resolvable | projection only | Yes |
| Sensitive Session expiry | Server Session Store | Short-lived / timeout | 不可信任 Client 倒數 | Yes |
| Final report row scope | Trusted API / BQ RLS / Authorized View / ACL | Request/data policy | result only | Yes |

---

## 2. Client Interaction State

例如：

```text
requestedView
selectedStoreCode
UI filters
navigation state
```

建議預設放在 Browser memory。

需要頁面重新整理後保留時，可視 UX 使用：

```text
route / URL
sessionStorage
```

`localStorage` 或 cookie 只建議拿來存非機敏 Preference。

這些值的語意都是：

> Client 想做什麼。

不是：

> Client 有權做什麼。

---

## 3. Store Device Binding

Device Binding 是長生命週期、Server authoritative state。

Reference 建議：

```text
Server-side durable Binding Store
```

可以是：

```text
existing enterprise DB
relational table
document store
other durable server-side store
```

正式產品由 PIC 決定。

Browser 端只建議保存 opaque identifier，例如：

```text
store_device_binding=<opaque-id>
```

若使用 Cookie，建議等效安全屬性：

```text
HttpOnly
Secure
SameSite
```

Server 收到 identifier 後，再解析：

```text
binding exists
status=ACTIVE
not revoked
not expired (if policy exists)
→ storeCode
```

不應使用：

```text
storeCode=A001
isStoreDevice=true
```

這類 Client 可自行修改值作為可信 Binding。

---

## 4. Human / Sensitive Session

Human Session 是較短生命週期的 state。

建議：

```text
server-side Session Store
or
server-verified Enterprise IdP session/token
```

需要支援：

```text
logout
idle timeout
expiry
revocation / invalidation where applicable
```

Human Session 與 Device Binding 即使都用同一個 Domain Cookie，也應維持不同 key / state lifecycle。

因此：

```text
clear Human Session cookie/session
!=
clear Store Device Binding
```

---

## 5. Authorization

`role` / `allowedStoreCodes` 不建議由 Browser 持久保存後當作權限真相。

正式 SSOT 應是：

```text
AOM / HR / ACL / existing enterprise authorization source
```

Server 可以依效能需求做短 TTL Cache，但 Cache 必須可以失效、重新解析，不能變成另一份長期人工維護的權限真相。

Reference：

```text
userId
→ Authorization SSOT
→ role + allowedStoreCodes
→ optional server cache
→ request guard
```

---

## 6. Data Access

這一層不是一般 Session Storage，而是最終 Security Enforcement。

正式方案可以是：

```text
Trusted API Guard
BigQuery RLS
Authorized View
existing enterprise ACL
```

不論採哪一種，必須達成等效條件：

```text
requestedStoreCode in server-resolved allowedStoreCodes
```

Looker Studio filter / iframe parameter / Client selectedStoreCode 不算 final enforcement。

---

## 7. 一句話交接

```text
UI State       → Browser
Device Binding → durable Server Store
Human Session  → short-lived Server Session
Authorization  → enterprise SSOT (+ optional short cache)
Row Access     → trusted Data Layer
```

真正需要 PIC 決定的是「用哪個既有技術承載這些語意」，而不是重新決定 State 的 ownership。