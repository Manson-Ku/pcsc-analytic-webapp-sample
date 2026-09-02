# Adapter Contract v0.3

## 0. 設計目的

Reference Sample 固定上層業務狀態機，但不綁死 PIC / PCSC 底層技術。

目前正式 Reference Contract 已明確分成四個能力：

```text
Web App Business State Machine
        |
        +--> StoreAccountResolver
        +--> StoreDeviceBindingProvider
        +--> HumanIdentityProvider
        +--> AuthorizationProvider
```

核心差異：

```text
Store Google Account
→ 用於建立 / 驗證 Device Binding

Device Binding
→ 提供 verified Store Context

Human Identity
→ 提供目前操作機敏資料的人員身分

Authorization
→ 提供此人可以查看哪些門市
```

---

## 1. StoreAccountResolver

回答：

> 已驗證的門市 Google Workspace 帳號對應哪一個 `storeCode`？

```ts
export interface StoreAccountResolver {
  resolveStore(verifiedGoogleIdentity: {
    subject: string;
    email: string;
  }): Promise<{
    storeCode: string;
  }>;
}
```

### Sample output

```json
{
  "storeCode": "A001"
}
```

### Production 責任

正式 mapping 來源由 PIC / PCSC 決定，例如：

```text
Google Workspace Store Account
→ AOM / PCSC mapping
→ storeCode
```

若帳號無法 map 到唯一門市，不得建立 Device Binding。

---

## 2. StoreDeviceBindingProvider

回答兩個問題：

> 目前 Browser / Device 是否已有有效的門市 Binding？

以及：

> 經門市 Google 帳號驗證後，如何建立 / 解除 Binding？

```ts
export interface StoreDeviceBindingProvider {
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

### Sample bound output

```json
{
  "bindingId": "DEVICE-BIND-001",
  "storeCode": "A001",
  "status": "ACTIVE"
}
```

### Sample unbound output

```json
{
  "bindingId": null,
  "storeCode": null,
  "status": "NONE"
}
```

### 關鍵生命週期規則

```text
logoutHuman() != unbindDevice()
IDLE_TIMEOUT != unbindDevice()
```

Human Session 清除後，Device Binding 仍可保持 `ACTIVE`。

詳細規格：`docs/07-store-device-binding-v0.3.md`

---

## 3. HumanIdentityProvider

回答：

> 目前完成個人驗證的人是誰？

```ts
export interface HumanIdentityProvider {
  authenticate(): Promise<{
    userId: string;
    email: string;
  }>;

  logout?(): Promise<void>;
}
```

### Sample output

```json
{
  "userId": "USER-001",
  "email": "manager.wang@example.com"
}
```

### 不負責

Human Identity Provider 不直接決定：

```text
Store Device Binding
使用者角色
可查看哪些門市
RLS policy
selected store
```

若 Human Login 與 Store Binding 技術上都使用 Google Workspace，也必須視為兩個不同 Authentication Ceremony / Session lifecycle。

若所謂 Human Account 實際是多人共用的門市 Google 帳號，該帳號本身不能唯一證明是哪一位自然人；若機敏報表需要 person-level authorization，Production 仍須提供唯一 `userId` 的額外個人驗證來源。

---

## 4. AuthorizationProvider

回答：

> 指定 `userId` 現在被授權查看哪些門市？

```ts
export interface AuthorizationProvider {
  resolveAuthorization(userId: string): Promise<{
    role: string;
    allowedStoreCodes: string[];
  }>;
}
```

### Sample output

```json
{
  "role": "STORE_MANAGER",
  "allowedStoreCodes": ["A001", "B001"]
}
```

Device Binding 的 `storeCode=A001` 不得自動轉換成：

```text
allowedStoreCodes=[A001]
```

兩者是不同資料來源與不同語意。

---

## 5. Optional Sensitive Data Contract

Demo 可以使用 Mock Data，但正式系統建議機敏 API 至少接受：

```ts
export interface SensitiveReportRequest {
  selectedStoreCode: string;
}
```

真正的 `userId` / session identity 應由受信任 server-side session / token 取得，不建議只相信 Browser body 傳入的 userId。

Pseudo server guard：

```ts
const human = await resolveServerSideHumanSession(request);
const authz = await authorizationProvider.resolveAuthorization(human.userId);

if (!authz.allowedStoreCodes.includes(requestedStoreCode)) {
  throw new ForbiddenError();
}

return loadSensitiveReport(requestedStoreCode);
```

---

## 6. Suggested Production Device-Binding Session

Reference Spec 不強制實作細節，但建議等效模型：

```text
門市 Google Account 驗證成功
→ StoreAccountResolver 得到 storeCode
→ Server 建立 Device Binding record
→ Browser 保存 opaque binding/session identifier
→ 後續 BOOT 由 Server resolve Binding
→ verified Store Context
```

Browser 不應自行宣告並讓 Server 直接相信：

```text
isStoreDevice=true
storeCode=A001
```

若使用 Cookie，建議符合等效：

```text
HttpOnly
Secure
SameSite
Server validation
```

---

## 7. Adapter Replacement Rule

POC：

```text
MockStoreAccountResolver
MockStoreDeviceBindingProvider
MockHumanIdentityProvider
MockAuthorizationProvider
```

Production：

```text
PCSCStoreAccountResolver
PCSCStoreDeviceBindingProvider
PCSCHumanIdentityProvider
PCSCAuthorizationProvider
```

必須維持：

```text
Business State Machine semantics unchanged
Device Binding lifecycle unchanged
UI authorization semantics unchanged
```

若正式既有系統無法直接提供上述資料，可在 Adapter 內轉譯；不應把企業底層差異散落到每一個 UI component。

---

## 8. Security Boundary

Reference Sample 僅示範業務規則，因此：

```text
Mock store binding != production device binding
Mock login != production authentication
Mock ACL != production authorization
Client-side guard != production access control
```

正式實作至少應由 Server 驗證 Device Binding / Human Session，並由 Server / Data Layer 再次驗證機敏資料 access authorization。
