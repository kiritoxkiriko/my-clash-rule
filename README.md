# my-clash-rule

基于本仓库 `rules/*.list` 整理的 `mihomo / Clash Meta` 配置模板。

---

## 使用

### 直接引用 YAML

```text
https://raw.githubusercontent.com/kiritoxkiriko/my-clash-rule/refs/heads/main/my-clash-rule.yaml
```

适用于：

* `mihomo`
* `Clash Meta`
* 支持导入/覆写 YAML 配置的客户端

---

### 本地修改

优先修改 [my-clash-rule.yaml](./my-clash-rule.yaml) 里的这几部分：

* `proxy-providers`
* `use`
* `proxy-groups`

如果只是想填入自己的机场订阅，通常只需要改 `proxy-providers` 和 `use`。

---

## 规则来源

规则文件位于 `rules/` 目录，`my-clash-rule.yaml` 会通过 `rule-providers` 引用这些规则。

---

## 分流规则

当前包含的分流大致有：

* `Direct`
* `China`
* `Ads`
* `Proxy`
* `AI`
* `Games-Direct`
* `Games-Proxy`
* `Dev-CN`
* `Dev`
* `Netflix`
* `Disney`
* `Video-TW`
* `Video-US`
* `Video-JP`
* `Video-Common`
* `VRChat`

---

## ☁️ Cloudflare Worker

仓库里提供了一个简单的 Worker 示例：

* [worker.js](./worker.js)（入口）
* [stashify.mjs](./stashify.mjs)（转换逻辑）

特点：

* 使用 ES Module
* 支持多文件引用（Workers Modules 模式）
* 逻辑拆分清晰，方便维护

---

### 功能

* 接收订阅链接
* 返回已经替换好 `订阅一` 的 `my-clash-rule.yaml`
* 可选转换成兼容 Stash 的 YAML
* 可选给 YAML 里的 GitHub 资源地址加上 `ghproxy` 前缀

---

### 请求参数

* `sub`：订阅链接（必填）
* `target=stash` / `format=stash` / `stash=1`：输出 Stash 兼容版 YAML
* `provider=1`：返回 `proxies:` 节点（内部使用）
* `ghproxy`：是否启用 GitHub 加速（支持 `1/true/yes/on`）

---

### 使用示例

普通模式：

```text
https://your-worker.workers.dev/?sub=https%3A%2F%2Fexample.com%2Fsubscribe&ghproxy=1
```

Stash 模式：

```text
https://your-worker.workers.dev/?sub=https%3A%2F%2Fexample.com%2Fsubscribe&target=stash
```

---

### 部署

仓库已提供 [wrangler.toml](./wrangler.toml)，直接部署即可：

```bash
npm install -g wrangler
wrangler login
wrangler deploy
```

如需修改 Worker 名称，可编辑 `wrangler.toml` 中的 `name`。

---

## ⚙️ GitHub Actions 自动部署 Worker

支持 push 自动部署 Worker，无需本地执行 `wrangler deploy`。

---

### 前置准备

在 GitHub 仓库中添加 Secrets：

路径：

```text
Settings → Secrets and variables → Actions
```

添加：

* `CLOUDFLARE_API_TOKEN`
* `CLOUDFLARE_ACCOUNT_ID`

---

### API Token

创建方式：

* 使用模板：`Edit Cloudflare Workers`
* 权限：
  `Account → Cloudflare Workers → Edit`

---

### Account ID

在 Cloudflare Dashboard 右侧可直接找到：

```text
Account ID
```

---

### 创建 Workflow

创建文件：

```text
.github/workflows/deploy.yml
```

内容：

```yaml
name: Deploy Worker

on:
  push:
    branches:
      - main
    paths:
      - 'worker.js'
      - 'stashify.mjs'
      - 'wrangler.toml'
      - '.github/workflows/deploy.yml'

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Deploy
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

---

### 触发规则

当以下文件变更时自动部署：

* `worker.js`
* `stashify.mjs`
* `wrangler.toml`

---
