# Scenario Sequence v0.1

## Scenario A：門市員工查看一般報表

```mermaid
sequenceDiagram
    actor Staff as 門市員工
    participant Web as Analytic Web App
    participant Store as StoreIdentityProvider

    Staff->>Web: 開啟 Web App
    Web->>Store: resolveStoreContext()
    Store-->>Web: storeCode=A001
    Web-->>Staff: 顯示 A001 一般門市報表
```

業務重點：

- 不要求門市一般員工再登入自己的個人帳號。
- 一般報表依 Store Context 顯示。
- 此狀態不能取得機敏資料。

---

## Scenario B：店長在 A 店查看 A / B 店機敏報表

```mermaid
sequenceDiagram
    actor Manager as 王店長
    participant Web as Analytic Web App
    participant Store as StoreIdentityProvider
    participant Human as HumanIdentityProvider
    participant ACL as AuthorizationProvider
    participant Data as Sensitive Data API

    Manager->>Web: 在 A 店 WebSC 開啟 Web App
    Web->>Store: resolveStoreContext()
    Store-->>Web: A001
    Web-->>Manager: 顯示 A001 一般報表

    Manager->>Web: 點擊「進階 / 機敏報表」
    Web->>Human: authenticate()
    Human-->>Web: USER-001 / manager.wang@example.com
    Web->>ACL: resolveAuthorization(USER-001)
    ACL-->>Web: STORE_MANAGER, [A001, B001]

    Note over Web: A001 同時是目前 Store Context 且在 allowedStores 中
    Web-->>Manager: 預設顯示 A001 機敏報表，可切換 B001

    Manager->>Web: 切換 B001
    Web->>Data: request B001 sensitive data with human session
    Data-->>Web: B001 data
    Web-->>Manager: 顯示 B001 機敏報表
```

業務重點：

- `A001` 只作為登入後的 UI 預設門市。
- 王店長仍可切換到其授權範圍內的 B001。
- 不能因「人在 A 店」而把實際授權縮限為 A 店。

---

## Scenario C：區顧問使用自己的公司電腦

```mermaid
sequenceDiagram
    actor Advisor as 陳區顧問
    participant Web as Analytic Web App
    participant Store as StoreIdentityProvider
    participant Human as HumanIdentityProvider
    participant ACL as AuthorizationProvider

    Advisor->>Web: 使用公司 Notebook 開啟 Web App
    Web->>Store: resolveStoreContext()
    Store-->>Web: none
    Web-->>Advisor: 顯示個人登入入口

    Advisor->>Web: 登入
    Web->>Human: authenticate()
    Human-->>Web: USER-002 / advisor.chen@example.com
    Web->>ACL: resolveAuthorization(USER-002)
    ACL-->>Web: AREA_ADVISOR, [A001,B001,C001,D001]
    Web-->>Advisor: 顯示授權門市選擇器
    Advisor->>Web: 選擇 C001
    Web-->>Advisor: 顯示 C001 機敏報表
```

業務重點：

- Store Context 不存在時仍可登入個人身分。
- 個人公司電腦不是門市裝置也不阻止機敏報表使用。
- 能看哪些店由 Authorization 決定。

---

## Scenario D：共用 WebSC 忘記登出

```mermaid
sequenceDiagram
    actor Manager as 王店長
    participant Web as Analytic Web App
    participant Session as Human Session

    Note over Web: storeContext=A001
    Manager->>Web: 已登入並查看機敏報表
    Web-->>Manager: Sensitive Mode

    Note over Manager,Web: 一段時間無操作
    Session-->>Web: idle timeout
    Web->>Web: clear Human Identity
    Web->>Web: clear Authorization
    Web->>Web: clear sensitive data
    Note over Web: 保留 storeContext=A001
    Web-->>Manager: 回到 A001 一般門市報表
```

核心規則：

```text
Human Session timeout
!=
Store Context logout
```

---

## Scenario E：授權失敗

```mermaid
sequenceDiagram
    actor User as 公司使用者
    participant Web as Analytic Web App
    participant Human as HumanIdentityProvider
    participant ACL as AuthorizationProvider

    User->>Web: 要求進入機敏報表
    Web->>Human: authenticate()
    Human-->>Web: USER-999
    Web->>ACL: resolveAuthorization(USER-999)
    ACL-->>Web: role=OTHER, allowedStores=[]
    Web-->>User: 無機敏報表權限
```

不得因為「Google 登入成功」就視為具有機敏資料權限。
