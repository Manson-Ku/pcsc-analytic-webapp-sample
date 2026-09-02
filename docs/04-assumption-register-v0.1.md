# Assumption Register v0.1

目的：讓 Reference Spec 可以先前進，同時明確標示哪些底層企業事實尚待 PIC / AOM / PCSC 確認。

| ID | Assumption | Status | Sample 是否可先做 | 正式整合影響 |
|---|---|---|---|---|
| A01 | 門市身分最終能解析成唯一 `storeCode` | 待 AOM / PIC 確認 | 是 | StoreIdentityProvider |
| A02 | 店長 / 區顧問有可辨識唯一個人的公司帳號 | 待 PIC 確認 | 是 | HumanIdentityProvider |
| A03 | 存在或可建立 `user -> role -> allowed stores` 權限來源 | 待 PIC / AOM 確認 | 是 | AuthorizationProvider |
| A04 | 公司已有可沿用的 Google Workspace Login / SSO 架構 | 待尚文 / PIC 確認 | 是 | HumanIdentityProvider 實作 |
| A05 | WebSC / 門市平板已有某種裝置管理或設備清單 | 待確認 | 是 | Device Trust / Store Context 強化 |
| A06 | Human sensitive session 需要 idle timeout | 業務方向已確認 | 是 | Session config |
| A07 | Production timeout 秒數 | TBD | 是 | Session config |
| A08 | 一般門市報表可依門市帳號使用，不強制綁特定裝置 | 目前業務回答偏向成立 | 是 | StoreIdentityProvider / Security review |

---

## Assumption 使用原則

1. Assumption 不等於正式事實。
2. Sample 可用 Mock Data 代表它，但必須標示 `DEMO / MOCK`。
3. PIC 回覆正式資料來源後，優先替換 Adapter，不改上層 Business State Machine。
4. 若企業既有架構與本文件不同，先判斷它是否仍能滿足既定 Business Contract，而不是直接推翻業務流程。

---

## 已確認、不是 Assumption 的 Business Rules

### BR-01 一般門市報表

一般門市員工在 WebSC / 門市平板使用時，目標場景是不要求每位員工再登入自己的個人帳號，即可查看該門市的一般報表。

### BR-02 機敏資料需 Human Identity

店長 / 區顧問要查看機敏報表時，需要額外完成個人公司身分驗證。

### BR-03 機敏存取不綁特定載具

只要完成個人驗證與授權，店長 / 區顧問可從門市裝置或自己的公司電腦查看機敏報表。

### BR-04 Allowed Stores 決定可見範圍

能查看哪些門市，由人員授權清單決定，不由目前人所在門市決定。

### BR-05 Current Store 可作 UX Default

若使用者在 A 店登入，而且 A 店位於其 allowed stores 中，可預設先顯示 A 店，但不縮限其其他已授權門市。

### BR-06 Human Session 與 Store Context 分離

共用 WebSC / 平板上的 Human Sensitive Session timeout 後，應清除個人機敏身分並回到該門市一般報表，而不是登出整台裝置的門市 Context。
