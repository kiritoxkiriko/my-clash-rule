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

作用：

- 接收订阅链接
- 返回已经替换好 `订阅一` 的 `my-clash-rule.yaml`
- 可选给 YAML 里的 GitHub 资源地址加上 `ghproxy` 前缀

请求参数：

- `sub`：订阅链接，必填
- `ghproxy`：是否启用 GitHub 资源加速，可选，支持 `1/true/yes/on`

调用示例：

```text
https://your-worker.workers.dev/?sub=https%3A%2F%2Fexample.com%2Fsubscribe&ghproxy=1
```

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
