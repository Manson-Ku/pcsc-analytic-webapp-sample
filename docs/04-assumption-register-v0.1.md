# Assumption Register v0.3

目的：讓 Reference Spec 可以先前進，同時明確標示哪些底層企業事實已決議、哪些仍待 PIC / AOM / PCSC 確認。

## 已決議，不再是 Assumption

| ID | Decision | Status | 備註 |
|---|---|---|---|
| D01 | 門市裝置的 Store Context 以「門市 Google Workspace 帳號完成 Device Binding」建立 | DECIDED | Google 帳號是建立 Binding 的驗證來源，不等於 Binding 本身 |
| D02 | 綁定成功後建立獨立 Device Binding / Store Device Session | DECIDED | 後續 BOOT 由 Server 驗證 Binding 並解析 storeCode |
| D03 | Human Session 與 Device Binding 分離 | DECIDED | `logoutHuman() != unbindDevice()` |
| D04 | Human idle timeout 不解除門市綁定 | DECIDED | timeout 後回已綁定門市的一般報表 |
| D05 | 解除門市綁定必須是獨立明確事件 `UNBIND_DEVICE` | DECIDED | 權限與操作流程由 Production Policy 定義 |

---

## 仍待確認的 Assumptions / Integration Facts

| ID | Assumption / TBD | Status | Sample 是否可先做 | 正式整合影響 |
|---|---|---|---|---|
| A01 | 門市 Google Workspace 帳號 → `storeCode` 的正式 mapping SSOT 在哪裡 | 待 AOM / PIC 確認 | 是 | StoreAccountResolver |
| A02 | 店長 / 區顧問是否皆有可唯一辨識自然人的公司帳號 / `userId` | 待 PIC 確認 | 是 | HumanIdentityProvider |
| A03 | 存在或可建立 `user -> role -> allowed stores` 權限來源 | 待 PIC / AOM 確認 | 是 | AuthorizationProvider |
| A04 | 公司已有可沿用的 Google Workspace Login / SSO 架構 | 待尚文 / PIC 確認 | 是 | Store Binding / Human Identity 實作 |
| A05 | Device Binding 實際持久化範圍：Browser profile、OS device 或既有受管裝置 identity | TBD | 是 | StoreDeviceBindingProvider |
| A06 | Binding token / session 的正式 TTL、revalidation、rotation、revocation policy | TBD | 是 | StoreDeviceBindingProvider |
| A07 | `UNBIND_DEVICE` 誰能操作、是否需重新驗證門市帳號、是否由後台集中撤銷 | TBD | 是 | Device Binding 管理 |
| A08 | Human sensitive session idle timeout 正式時間 | TBD | 是 | Human Session config |
| A09 | BigQuery / Looker Studio 正式 Enforcement 架構 | TBD | 是 | Data / BI layer |
| A10 | 若 Human Login 使用的 Google account 與門市共用帳號相同，如何取得唯一自然人 `userId` | 待 PIC / 業務確認 | 是 | Person-level Authorization |
| A11 | WebSC / 門市平板是否另有 MDM / Endpoint / 裝置憑證可作額外 Device Trust | 待確認；非 Store Context 必要條件 | 是 | Optional hardening |

---

## Assumption 使用原則

1. 已決議 Business / Architecture Decision 不再以「可能」語氣描述。
2. Assumption 不等於正式事實。
3. Sample 可用 Mock Data 代表未定實作，但必須標示 `DEMO / MOCK`。
4. PIC 回覆正式資料來源後，優先替換 Adapter，不改上層 Business State Machine。
5. 若企業既有架構與 Reference 技術形式不同，先判斷是否仍能滿足既定 Contract。

---

## 已確認 / 已決議 Business Rules

### BR-01 一般門市報表

已完成有效 Device Binding 的門市 Browser / Device，可以從 Binding 解析 Store Context，並直接顯示該門市一般報表；不要求每位門市員工再登入自己的個人帳號。

### BR-02 門市 Device Binding

首次綁定以門市 Google Workspace 帳號完成驗證：

```text
Store Google Identity
→ StoreAccountResolver
→ storeCode
→ Server 建立 Device Binding
```

之後 Store Context 由有效 Binding 解析，不等於每次都重新登入門市 Google 帳號。

### BR-03 機敏資料需 Human Identity

店長 / 區顧問查看機敏報表時，需要額外建立 Human Session。

### BR-04 機敏存取不綁特定載具

只要完成個人驗證與授權，店長 / 區顧問可以從已綁定門市裝置或未綁定裝置進入機敏報表。

### BR-05 Allowed Stores 決定可見範圍

能查看哪些門市，由 Human Authorization 清單決定，不由 Device Binding 所屬門市決定。

### BR-06 Current Store 可作 UX Default

若 Device Binding=A 店，而且 A 店位於 Human Allowed Stores 中，可預設 Selected Store=A，但不縮限其他已授權門市。

### BR-07 Human Session 與 Device Binding 分離

```text
logoutHuman() != unbindDevice()
IDLE_TIMEOUT != unbindDevice()
```

Human Session timeout / logout 後，Device Binding 保留，回到綁定門市的一般報表。

### BR-08 Device Unbind 必須獨立操作

只有明確的 `UNBIND_DEVICE` / revoke 動作才會移除或失效門市 Device Binding。

詳細規格：`docs/07-store-device-binding-v0.3.md`
