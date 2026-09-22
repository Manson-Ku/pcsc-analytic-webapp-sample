# GDS Embedded Auth Experiment Log

Date: 2026-09-22

## Test Report

```text
Report: GDS-WEB test1
Embedding: Enabled
Sharing: Restricted
```

公開 Repo 不保存實際測試帳號 email，以下稱 Account A / Account B。

## Observation 1｜一般 Chrome

Browser active Google Account 沒有權限時，GDS 顯示目前使用的 Google Account 無法存取 Report。

切換 Browser Google Account 後，GDS 顯示的 account 也跟著改變。

結論：

```text
GDS Viewer Identity
comes from Browser Google Session
```

不是 WordPress / Web Session。

## Observation 2｜Incognito

無痕模式顯示第三方 Cookie 必須允許。

即使無痕中已登入 Google Account，第三方 Cookie 被阻擋時 embedded auth 仍無法正常工作。

## Observation 3｜Multi-account

同一 Browser 同時登入兩個 Google Account 時，GDS 出現 account selector。

Network 可觀察：

```text
/embed/u/0/reporting/...
```

切換帳號後：

```text
/embed/u/1/reporting/...
```

## Observation 4｜Same page /u/0 + /u/1

同頁分別指定：

```html
<iframe src=".../embed/u/0/reporting/..."></iframe>
<iframe src=".../embed/u/1/reporting/..."></iframe>
```

實測有效。

## Interpretation

`u/0`、`u/1` 是 Browser 當下 Google multi-login slot。

它們不是：

```text
stable user id
email mapping key
authorization key
```

## Research Stop Point

這一輪已足夠回答：

```text
GDS iframe 從哪裡取得 viewer identity？
```

答案：

```text
Browser Google Session
→ GDS Viewer
```

因此停止深入研究 iframe / cookie / slot mapping。

下一階段只測：

```text
GDS Viewer
→ Viewer's Credentials
→ BigQuery SESSION_USER()
→ RLS
```