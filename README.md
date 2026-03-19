# my-clash-rule

基于本仓库 `rules/*.list` 整理的 `mihomo / Clash Meta` 配置模板。

## 使用

### 直接引用 YAML

```text
https://raw.githubusercontent.com/kiritoxkiriko/my-clash-rule/refs/heads/main/my-clash-rule.yaml
```

适用于：

- `mihomo`
- `Clash Meta`
- 支持导入/覆写 YAML 配置的客户端

### 本地修改

优先修改 [my-clash-rule.yaml](./my-clash-rule.yaml) 里的这几部分：

- `proxy-providers`
- `use`
- `proxy-groups`

如果只是想填入自己的机场订阅，通常只需要改 `proxy-providers` 和 `use`。

## 规则来源

规则文件位于 `rules/` 目录，`my-clash-rule.yaml` 会通过 `rule-providers` 引用这些规则。

## Cloudflare Worker

仓库里提供了一个简单的 Worker 示例，文件见 [worker.js](./worker.js)。
转换逻辑单独放在 [stashify.mjs](./stashify.mjs)，`worker.js` 通过模块引用它，而不是把转换逻辑直接写进 Worker 入口。

作用：

- 接收订阅链接
- 返回已经替换好 `订阅一` 的 `my-clash-rule.yaml`
- 可选自动转换成兼容 Stash 的 YAML
- 可选给 YAML 里的 GitHub 资源地址加上 `ghproxy` 前缀

请求参数：

- `sub`：订阅链接，必填
- `target=stash` / `format=stash` / `stash=1`：输出 Stash 兼容版 YAML，可选
- `provider=1`：返回 Stash 可直接消费的 `proxies:` 节点集，通常由 Worker 在 `target=stash` 时内部自动调用
- `ghproxy`：是否启用 GitHub 资源加速，可选，支持 `1/true/yes/on`

调用示例：

```text
https://your-worker.workers.dev/?sub=https%3A%2F%2Fexample.com%2Fsubscribe&ghproxy=1
```

输出 Stash 兼容版：

```text
https://your-worker.workers.dev/?sub=https%3A%2F%2Fexample.com%2Fsubscribe&target=stash
```

### 部署

仓库已提供 [wrangler.toml](./wrangler.toml)，可以直接按 Cloudflare Workers 的模块方式部署，多文件引用会保留生效。

示例命令：

```bash
npm install -g wrangler
wrangler login
wrangler deploy
```

如需修改 Worker 名称，可编辑 `wrangler.toml` 中的 `name`。

当前包含的分流大致有：

- `Direct`
- `China`
- `Ads`
- `Proxy`
- `AI`
- `Games-Direct`
- `Games-Proxy`
- `Dev-CN`
- `Dev`
- `Netflix`
- `Disney`
- `Video-TW`
- `Video-US`
- `Video-JP`
- `Video-Common`
- `VRChat`
