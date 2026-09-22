# docs index

目前有效文件：

1. [00-developer-quickstart-v0.4.md](./00-developer-quickstart-v0.4.md)
2. [01-web-device-binding-v0.4.md](./01-web-device-binding-v0.4.md)
3. [02-gds-report-profiles-v0.1.md](./02-gds-report-profiles-v0.1.md)
4. [03-gds-bq-rls-v0.1.md](./03-gds-bq-rls-v0.1.md)
5. [04-experiment-log-2026-09-22.md](./04-experiment-log-2026-09-22.md)

舊 v0.1–v0.3 文件屬於 2026-09-22 以前的大型 State Machine 設計，已被 v0.4 supersede。

它們暫時保留供歷史比對，但不得再作為正式開發依據。

新的核心模型：

```text
Web:
Device Binding → Store Context

GDS:
Google Account → GDS Viewer → BigQuery RLS
```