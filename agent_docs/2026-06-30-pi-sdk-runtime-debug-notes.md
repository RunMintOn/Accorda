# Pi SDK 接入排查记录

日期：2026-06-30

## 背景

Accorda 新增了 Pi SDK 入口：

- `npm run pi:once`
- `npm run pi:dev`

目标是复用 Pi SDK 的模型、认证、工具调用能力，同时在 Accorda 层记录 readable trace。

## 这次遇到的问题

### 1. `pi:dev` 发消息后没有回复

现象：

```text
> 你好
>
```

原因：最初只监听了 streaming `text_delta`。如果 provider 没有走这个事件，或者最终消息只进入 session history，终端就看不到回复。

处理：

- 保留 streaming 输出
- 如果没有收到 streaming delta，则在 `session.prompt()` 结束后从 `session.messages` 读取最后一条 assistant 文本并打印
- 同时打印 `auto_retry_start / auto_retry_end` 错误

相关文件：

```text
src/pi/piDev.ts
```

### 2. `fetch failed`

现象：

```text
[retry] fetch failed
[error] fetch failed
```

一开始怀疑 auth/model 配置，但原生 `pi` 在同一环境中可用，所以真实原因不是登录失败。

最终原因：Accorda 通过 SDK 自己启动 Node 进程时，没有像 Pi CLI 那样配置 undici HTTP dispatcher。虽然环境变量里有：

```text
HTTP_PROXY=http://127.0.0.1:7897
HTTPS_PROXY=http://127.0.0.1:7897
```

但 Node fetch 默认不会可靠使用这些代理设置。

处理：新增 undici proxy 配置：

```text
src/pi/httpProxy.ts
```

并在入口启动时调用：

```ts
configureProxyFromEnv()
```

相关入口：

```text
src/pi/piDev.ts
src/pi/runPiOnce.ts
```

## 本地 Pi 配置隔离

Accorda 不直接使用全局 `~/.pi/agent`，而是使用项目内目录：

```text
.accorda/pi-agent/
```

首次运行时会从全局 Pi 配置复制：

```text
auth.json
models.json
settings.json
```

这样可以复用已有登录状态，又避免 Accorda 直接污染全局 Pi 配置。

相关文件：

```text
src/pi/localPiAgent.ts
```

## 以后遇到类似问题的排查顺序

1. 先确认原生 `pi` 在同一终端里是否能正常请求模型。
2. 如果原生 `pi` 可用，而 Accorda SDK 入口失败，优先检查：
   - `.accorda/pi-agent/auth.json`
   - `.accorda/pi-agent/settings.json`
   - HTTP/HTTPS 代理是否被 undici dispatcher 接管
3. 如果表现为没有输出，检查是否只是没有收到 streaming delta；需要 fallback 到 `session.messages`。
4. 改完后跑：

```bash
npm test
```

## 当前结论

`fetch failed` 的关键修复是：SDK 入口必须主动配置 undici 的 `EnvHttpProxyAgent`，不能假设 Node fetch 自动走 `HTTP_PROXY / HTTPS_PROXY`。
