# Store Device Binding Model v0.3

## 目的

本文件正式定義「門市裝置」如何成立、Store Context 如何被建立，以及它與店長／區顧問 Human Session 的生命週期差異。

本 Reference Spec 的明確作法是：

> **門市裝置不是靠前端自行宣告，也不是先假設實體硬體序號；而是透過門市 Google Workspace 帳號完成一次 Store Device Binding。綁定成功後，系統建立獨立、可持續驗證的 Device Binding，之後由該 Binding 解析 Store Context。**

核心規則：

```text
Store Google Account login
!= Device Binding
!= Human Session
!= Human Authorization
```

其中 Google 帳號登入是「建立 Binding 的驗證步驟」，不是 Binding 本身。

---

## 1. 什麼叫「門市裝置」

在本規格中，`Store Device` 的業務語意是：

```text
目前這個 Browser / Device
存在一個仍有效、由 Server 驗證的 Store Device Binding
→ Binding 對應唯一 storeCode
```

例如：

```text
binding_id = DEVICE-BIND-001
store_google_account = store-a@7-11.example
store_code = A001
status = ACTIVE
```

因此：

```text
ACTIVE Device Binding
→ verified Store Context = A001
→ 可以進 A001 General Mode
```

這裡不要求 Reference Spec 先決定 Binding 最終綁「整台硬體」、「OS profile」或「Browser profile」。正式實作形式由 PIC 決定，但必須保存上述語意。

---

## 2. 首次綁定流程

Reference Flow：

```text
新裝置 / 尚未綁定 Browser
        ↓
DEVICE_UNBOUND
        ↓
使用者選擇「綁定門市裝置」
        ↓
REQUEST_DEVICE_BIND
        ↓
Google Workspace 驗證門市帳號
        ↓
STORE_ACCOUNT_AUTH_SUCCESS
        ↓
StoreAccountResolver
store-a@... → A001
        ↓
Server 建立 Device Binding
        ↓
DEVICE_BINDING_CREATED
        ↓
Store Context = A001
        ↓
GENERAL_MODE
```

若 Google 帳號不是可辨識的門市帳號，或無法 map 到唯一 `storeCode`：

```text
STORE_ACCOUNT_MAPPING_DENIED
→ 不得建立 Device Binding
```

---

## 3. 建議的 Production Binding Record

欄位名稱可以不同，但語意應等效：

```json
{
  "binding_id": "DEVICE-BIND-001",
  "store_code": "A001",
  "store_google_subject": "google-sub-or-stable-id",
  "store_google_email": "store-a@7-11.example",
  "status": "ACTIVE",
  "created_at": "...",
  "last_seen_at": "...",
  "expires_at": null
}
```

正式系統建議 Browser 只持有 opaque binding/session identifier，例如：

```text
store_device_binding=<opaque id>
```

並由 Server 驗證 Binding 是否：

```text
exists
ACTIVE
not revoked
not expired (if expiry policy exists)
```

若使用 Cookie，建議採等效安全原則：

```text
HttpOnly
Secure
SameSite
```

Browser 不應直接保存並讓 Server 信任：

```text
storeCode=A001
isStoreDevice=true
```

---

## 4. App 啟動時如何辨認門市

綁定完成後，之後每次進站不需要重新要求門市員工輸入門市 Google 帳號。

Reference Flow：

```text
BOOT
↓
Server resolve Device Binding
↓
Binding ACTIVE
↓
verifiedStoreContext=A001
↓
GENERAL_MODE
```

若沒有 Binding：

```text
BOOT
↓
Device Binding = NONE
↓
PERSONAL_ENTRY / DEVICE_UNBOUND
```

此時仍可：

```text
A. 執行 Store Device Binding
或
B. 不綁定裝置，直接以個人 Human Login 進入其授權的機敏報表
```

---

## 5. Device Binding 與 Human Session 必須分離

### Device Binding

回答：

> 「這個 Browser / Device 被綁定成哪一家門市的入口？」

生命週期通常較長。

### Human Session

回答：

> 「現在操作機敏報表的人是誰？」

生命週期較短，且需要 timeout / logout。

例如 A 店已綁定裝置：

```text
Device Binding = A001
Human Session = anonymous
→ A001 General Mode
```

王店長登入後：

```text
Device Binding = A001
Human Session = USER-001
Allowed Stores = [A001, B001]
→ Sensitive Mode
```

王店長退出：

```text
logoutHuman()

Device Binding = A001    ← KEEP
Human Session = null     ← CLEAR
Authorization = clear    ← CLEAR
→ A001 General Mode
```

因此正式 invariant：

```text
logoutHuman() != unbindDevice()
IDLE_TIMEOUT != unbindDevice()
```

---

## 6. 如何解除門市裝置綁定

解除 Binding 必須是另一個明確事件：

```text
UNBIND_DEVICE
```

而不是 Human Logout 的 side effect。

Reference Result：

```text
Device Binding → REVOKED / removed
verified Store Context → none
```

誰可以執行 `UNBIND_DEVICE`、是否需重新驗證門市 Google 帳號、是否由後台集中管理，屬 PIC / PCSC Production Policy，Reference Spec 不預設。

---

## 7. 「店長帳號 = 門市帳號」時仍需維持狀態分離

即使某個正式環境最後出現：

```text
店長登入所使用的 Google account
=
門市綁定時使用的 Google account
```

兩個動作仍屬不同 Authentication Ceremony：

```text
Store Binding Ceremony
目的：建立 / 證明 Store Device Binding

Human Ceremony
目的：建立目前機敏操作人的 Human Session
```

因此：

```text
Human logout
不應呼叫
UNBIND_DEVICE
```

但必須注意另一個獨立問題：

> 若該 Google 帳號是多人共用的「門市帳號」，它本身無法證明是哪一位自然人正在操作。

若機敏 Authorization 需要真正做到：

```text
person → role → allowed stores
```

則 Production Human Ceremony 仍必須取得可唯一辨識個人的 subject / userId；可能來自個人 Google Workspace 帳號或另一個二階段個人驗證方式。

此點不影響 Device Binding 與 Human Session 必須分離的架構決策。

---

## 8. Provider / Service Contract

建議拆成：

```ts
interface StoreAccountResolver {
  resolveStore(verifiedGoogleIdentity: {
    subject: string;
    email: string;
  }): Promise<{
    storeCode: string;
  }>;
}

interface StoreDeviceBindingProvider {
  resolveBinding(): Promise<{
    bindingId: string | null;
    storeCode: string | null;
    status: "ACTIVE" | "NONE" | "REVOKED";
  }>;

  bind(verifiedStoreGoogleIdentity: {
    subject: string;
    email: string;
  }): Promise<{
    bindingId: string;
    storeCode: string;
  }>;

  unbind(bindingId: string): Promise<void>;
}
```

正式 Provider 可以接既有 SSO、Google Workspace、AOM / 門市帳號 mapping、Server Session Store 或其他 PCSC 既有服務。

---

## 9. State Ownership

```text
Client
- request bind / unbind
- 顯示目前 Binding projection

Server
- 驗證 Google store identity
- map Google account → storeCode
- 建立 / 驗證 / revoke Device Binding
- verified Store Context SSOT

Data Layer
- Device Binding 只提供 General Store Context
- 不得因此自動授予 Human Sensitive Authorization
```

最重要的 invariant：

```text
Device Binding grants Store Context.
Device Binding does NOT grant Human sensitive authorization.
Human logout does NOT revoke Device Binding.
Only explicit Device Unbind / revoke changes Device Binding.
```