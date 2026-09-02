# Adapter Contract v0.1

## 0. 設計目的

Reference Sample 固定上層業務狀態機，但不綁死 PIC / PCSC 底層技術。

正式整合只需要用企業既有系統替換 Mock Adapter。

```text
Web App Business State Machine
        |
        +--> StoreIdentityProvider
        +--> HumanIdentityProvider
        +--> AuthorizationProvider
```

---

## 1. StoreIdentityProvider

回答：

> 目前這個 session / device 是否具有可辨識的門市 Context？

```ts
export interface StoreIdentityProvider {
  resolveStoreContext(): Promise<{
    storeCode: string | null;
  }>;
}
```

### Sample output

```json
{
  "storeCode": "A001"
}
```

或非門市裝置：

```json
{
  "storeCode": null
}
```

### 正式實作可能來源

以下僅列可能性，不代表 Reference Spec 已決定：

- Google Workspace 門市共用帳號 mapping
- AOM / PCSC 既有門市 mapping API
- 裝置憑證
- MDM / Endpoint metadata
- 既有 portal session

上層 Web App 不應依賴其中任一種方式。

---

## 2. HumanIdentityProvider

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

- 使用者角色
- 可查看哪些門市
- RLS policy
- selected store

---

## 3. AuthorizationProvider

回答：

> 指定 userId 現在被授權查看哪些門市？

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

---

## 4. Optional Sensitive Data Contract

Demo 可以使用 mock data，但正式系統建議機敏 API 至少接受：

```ts
export interface SensitiveReportRequest {
  selectedStoreCode: string;
}
```

真正的 `userId` / session identity 應由受信任 server-side session / token 取得，不建議只相信 browser body 傳入的 userId。

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

## 5. Adapter Replacement Rule

POC：

```text
MockStoreIdentityProvider
MockHumanIdentityProvider
MockAuthorizationProvider
```

Production：

```text
PCSCStoreIdentityProvider
PCSCHumanIdentityProvider
PCSCAuthorizationProvider
```

必須維持：

```text
Business State Machine unchanged
UI authorization semantics unchanged
```

若正式既有系統無法直接提供上述資料，可在 Adapter 內轉譯；不應把企業底層差異散落到每一個 UI component。

---

## 6. Security Boundary

Reference Sample 僅示範業務規則，因此：

```text
Mock login != production authentication
Mock ACL != production authorization
Client-side guard != production access control
```

正式實作至少應由 server side 再次驗證敏感資料 access authorization。
