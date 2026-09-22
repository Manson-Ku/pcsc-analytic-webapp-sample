# Web Device Binding v0.4

## 目的

Device Binding 只回答：

```text
這個 Browser / Device 現在代表哪一家門市？
```

它不回答：

```text
現在是哪一個 Google user？
現在是哪一位自然人？
這個人可以看哪些 GDS rows？
```

## 最小流程

```text
BOOT
→ Server resolve binding

ACTIVE
→ verified storeCode
→ General Surface

NONE
→ Binding Required
```

建立 Binding：

```text
Native Web Login / trusted enterprise flow
→ Server resolves storeCode
→ create opaque Device Binding
```

## Google Auth 的位置

Google Workspace 可以是一種建立 Binding 的方式，但不是規格要求。

正確抽象是：

```text
StoreResolutionProvider
→ storeCode
```

可能實作：

```text
native account mapping
enterprise SSO mapping
Google Workspace mapping
admin provisioning
```

所以不要把 Google login 硬寫成 Device Binding protocol。

## Production State

Server 應保存等效：

```json
{
  "bindingId": "opaque-id",
  "status": "ACTIVE",
  "storeCode": "A001",
  "createdAt": "...",
  "expiresAt": "..."
}
```

Browser 只保留 opaque id / secure session。

## Security

以下不能當正式 binding truth：

```text
?store=A001
localStorage.store=A001
client JS variable
hidden form field
GDS filter parameter
```

可信的 storeCode 必須由 Server resolve。