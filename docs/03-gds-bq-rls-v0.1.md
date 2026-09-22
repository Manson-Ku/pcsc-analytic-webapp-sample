# GDS → BigQuery RLS v0.1

Status: `NEXT POC`

## 目標

驗證：

```text
Google Account
→ GDS Viewer
→ Viewer's Credentials
→ BigQuery SESSION_USER()
→ Row Access Policy
```

## 最小 Mock Table

```sql
CREATE TABLE `PROJECT.gds_rls_poc.metrics` (
  viewer_email STRING,
  store_code STRING,
  metric_value INT64
);
```

測試資料：

```text
account-a@example.com | STORE_A | 100
account-b@example.com | STORE_B | 900
```

## Identity Debug

先只測：

```sql
SELECT SESSION_USER() AS current_google_user;
```

驗收：

```text
GDS Viewer A
→ SESSION_USER() = A
```

如果這一步不成立，不要先做 RLS。

## Row Access Policy

identity chain 成立後再加：

```sql
FILTER USING (
  viewer_email = SESSION_USER()
)
```

## IAM

Viewer's Credentials 代表 viewer 本身需要 BigQuery 查詢所需 IAM。

```text
IAM
→ 能不能 query

RLS
→ query 後能看到哪些 rows
```

## 驗收矩陣

| Viewer | SESSION_USER() | 預期 |
|---|---|---|
| Account A | A | STORE_A only |
| Account B | B | STORE_B only |
| Unauthorized | no usable access | no A/B data |

POC 完成條件：

```text
same GDS report
+
same BQ table
+
different Google viewers
=
different rows by RLS
```