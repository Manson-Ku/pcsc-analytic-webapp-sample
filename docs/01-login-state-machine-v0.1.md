# 登入與權限 State Machine v0.1

## 0. 文件定位

本文件是 **Reference Spec / Business-to-Technical Translation**。

它不是 PCSC 正式 IAM、SSO、Google Workspace、AOM 或裝置管理的最終實作規格。

目的：先把已確認的業務行為定義成工程團隊可理解、可驗證、可替換底層 Identity Provider 的狀態機。

---

## 1. 四個獨立 Context

系統不得用單一 `logged_in=true/false` 表示所有登入與權限狀態。

必須分開處理：

1. **Store Context**：目前是否知道這個 session / device 代表哪一家門市。
2. **Human Identity**：目前是否知道操作的人是誰。
3. **Authorization**：這個人被允許查看哪些門市。
4. **Selected Store**：目前 UI 正在查看哪一家門市。

### 核心不變式

```text
Store Context != Human Identity
Human Identity != Authorization
Authorization != Selected Store
Store Context 不授予機敏資料權限
Selected Store 必須存在於 Allowed Stores
```

---

## 2. Reference Context Model

```ts
export type HumanSessionStatus =
  | "anonymous"
  | "authenticating"
  | "authenticated"
  | "expired";

export type AuthorizationStatus =
  | "unresolved"
  | "resolving"
  | "resolved"
  | "denied";

export type StoreContextStatus = "unknown" | "resolved" | "none";

export type ViewMode = "general" | "sensitive";

export interface AppContext {
  storeContext: {
    status: StoreContextStatus;
    storeCode: string | null;
  };

  humanSession: {
    status: HumanSessionStatus;
    userId: string | null;
    email: string | null;
  };

  authorization: {
    status: AuthorizationStatus;
    role: string | null;
    allowedStoreCodes: string[];
  };

  selectedStoreCode: string | null;
  viewMode: ViewMode;
}
```

此資料模型僅是 Sample Contract；正式後端資料結構可不同。

---

## 3. 主狀態機

```text
BOOT
  |
  v
RESOLVE_STORE_CONTEXT
  |
  +----------------------------+
  |                            |
  | store resolved             | store none
  v                            v
GENERAL_MODE                PERSONAL_ENTRY
  |                            |
  | 點擊機敏報表                | 個人登入
  +-------------+--------------+
                |
                v
       HUMAN_AUTHENTICATING
                |
                | success
                v
        RESOLVE_AUTHORIZATION
                |
                | allowed stores > 0
                v
          SELECT_CONTEXT
                |
                v
          SENSITIVE_MODE
                |
                | human logout / timeout
                v
   CLEAR HUMAN + AUTHORIZATION
                |
        +-------+-------+
        |               |
        | store exists  | no store
        v               v
  GENERAL_MODE      PERSONAL_ENTRY
```

---

## 4. Store Context

### 4.1 Store resolved

Reference Example：

```text
store-a@example.com -> A001
```

則：

```text
storeContext.status = resolved
storeContext.storeCode = A001
```

系統可直接顯示 A001 一般門市報表，不要求每一位門市員工登入個人身分。

### 4.2 Store none

例如店長使用自己的公司 Notebook 進入 Web App：

```text
storeContext.status = none
```

此時仍可進入個人登入流程，完成驗證及授權後查看機敏報表。

因此 `Store Context` 不是 Human Login 的必要前置條件。

---

## 5. Human Identity

Human Authentication 只回答：

> 目前操作的人是誰？

Reference Example：

```text
manager.wang@example.com -> USER-001
```

此階段不得直接推論：

```text
USER-001 是店長
USER-001 可以看 A 店
USER-001 可以看 B 店
```

登入成功後仍必須進入 Authorization Resolution。

---

## 6. Authorization

Authorization Provider 回答：

> 這個人目前被授權查看哪些門市？

Example：

```text
USER-001
role = STORE_MANAGER
allowedStores = [A001, B001]
```

```text
USER-002
role = AREA_ADVISOR
allowedStores = [A001, B001, C001, D001]
```

實際權限不得由：

- 使用者目前所在門市
- 前端 query string
- UI 選單
- 前端 local state

直接決定。

---

## 7. Selected Store

`Selected Store` 是 UI Context，不是 Authorization Source。

Reference Default Rule：

```text
IF storeContext.storeCode exists
AND storeContext.storeCode in allowedStoreCodes
THEN selectedStoreCode = storeContext.storeCode
```

Example：

```text
Store Context = A001
Allowed Stores = [A001, B001]

登入後：
selectedStoreCode = A001
但仍可切換 B001
```

若無 Store Context：

```text
allowedStores = 1
-> 自動選唯一門市

allowedStores > 1
-> 顯示門市選擇器
```

---

## 8. Sensitive Mode Guard

Reference Guard：

```ts
export function canEnterSensitiveMode(ctx: AppContext): boolean {
  return (
    ctx.humanSession.status === "authenticated" &&
    ctx.authorization.status === "resolved" &&
    ctx.selectedStoreCode !== null &&
    ctx.authorization.allowedStoreCodes.includes(ctx.selectedStoreCode)
  );
}
```

正式實作時：

- 前端 Guard 只負責 UX。
- 後端每次機敏資料查詢仍必須再次驗證 Authorization。
- 隱藏按鈕不等於權限控制。

---

## 9. Shared Device Timeout

共用 WebSC / 門市平板上的個人機敏 Session 必須可獨立結束。

```text
A店一般門市模式
   |
   | 王店長登入
   v
王店長 Sensitive Session
   |
   | idle timeout / logout human
   v
clear humanSession
clear authorization
clear sensitive data
   |
   | keep storeContext=A001
   v
A店一般門市模式
```

因此：

```text
logoutHuman() != logoutStore()
```

Timeout 秒數屬設定值，Reference Sample 不將它硬編為正式需求。

---

## 10. Error / Denied States

### Human authentication failed

```text
HUMAN_AUTHENTICATING
-> failed
-> 回登入入口
```

### Human authenticated but no authorization

```text
AUTHENTICATED
-> AuthorizationProvider returns []
-> AUTHORIZATION_DENIED
-> 不進 Sensitive Mode
```

### Selected Store unauthorized

任何嘗試切換到不在 `allowedStoreCodes` 的門市：

```text
DENY
```

不得只依賴前端不顯示該選項。

---

## 11. Out of Scope

本版不定義：

- Google Workspace / SAML / OIDC 正式串接方式
- AOM 正式資料介面
- MDM / Device Trust 實作
- Token 格式
- Cookie / Session Storage 技術細節
- Production timeout 秒數
- Production RLS SQL / policy
- IAM group naming convention

以上均由正式實作團隊依企業既有技術框架接入 Adapter。
