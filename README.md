# my-clash-rule

基于本仓库 `rules/*.list` 维护的个人分流规则模板，当前同时提供：

* `mihomo / Clash Meta`
* `Stash`
* `sing-box`

---

## 直接引用

### mihomo / Clash Meta

```text
https://raw.githubusercontent.com/kiritoxkiriko/my-clash-rule/refs/heads/main/my-clash-rule.yaml
```

### Stash

```text
https://raw.githubusercontent.com/kiritoxkiriko/my-clash-rule/refs/heads/main/my-stash-rule.yaml
```

### sing-box

```text
https://raw.githubusercontent.com/kiritoxkiriko/my-clash-rule/refs/heads/main/my-singbox-rule.json
```

---

## 配置说明

### 分流组

当前包含：

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

### 地区组

普通地区组默认手动选择：

* `HK`
* `JP`
* `US`
* `TW`
* `SG`
* `KR`

高级地区组保留自动测速，并且在同一策略组里优先级高于普通地区组：

* `HK-Advance`
* `JP-Advance`
* `US-Advance`

高级地区组只匹配明确高级标识：`advance`、`advanced`、`高级`、`premium`；并排除 `标准`、`实验`、`实验性`、`test`、`beta`、`exp`、`experimental` 等非高级节点标识。

全局 `Auto` 自动测速组已移除，避免大范围跨地区自动切换。

### DNS

Clash / Stash 模板已把 DoH 改成 DoT。

sing-box 模板里：

* `local` 使用系统本地 DNS
* `local-119` 使用 `119.29.29.29`
* `local-223` 使用 `223.5.5.5`
* `remote` 使用 `1.1.1.1`
* `remote-8` 使用 `8.8.8.8`
* 国内/直连相关规则优先走 `local`
* 其他默认走 `remote`

---

## 本地修改

如果只是替换订阅地址，优先改：

* [my-clash-rule.yaml](./my-clash-rule.yaml) 的 `proxy-providers`
* [my-stash-rule.yaml](./my-stash-rule.yaml) 的 `proxy-providers`
* [my-singbox-rule.json](./my-singbox-rule.json) 的 `outbounds`

Clash / Stash 支持 `proxy-providers`，sing-box 模板不做订阅转换，需要手动把真实节点 outbound 加到 `Manual`、`Manual2`、地区组或 Advance 地区组里。

---

## 规则文件

源规则在 [rules/](./rules)：

```text
rules/*.list
```

Clash / Stash 直接引用这些 `.list`。

sing-box 使用两级生成结果：

* [rules-singbox/](./rules-singbox)：从 `rules/*.list` 转成 sing-box source rule-set JSON。
* [rules-singbox-srs/](./rules-singbox-srs)：从 `rules-singbox/*.json` 编译出的二进制 `.srs`。

[my-singbox-rule.json](./my-singbox-rule.json) 默认引用 `rules-singbox-srs/*.srs`。

`GEOSITE` / `GEOIP` 不能直接写进 sing-box source rule-set，所以模板通过 MetaCubeX 的远程 `.srs` 引用。

---

## 生成命令

修改 `rules/*.list` 后运行：

```bash
npm run generate:singbox-rules
npm run generate:singbox-srs
```

`generate:singbox-srs` 需要本机已安装 `sing-box`。

常用校验：

```bash
ruby -e "require 'yaml'; YAML.load_file('my-clash-rule.yaml'); YAML.load_file('my-stash-rule.yaml')"
sing-box check -c my-singbox-rule.json
```

---

## GitHub Actions

### Build sing-box rule sets

[build-singbox-rules.yml](./.github/workflows/build-singbox-rules.yml) 会在以下内容变化时触发：

* `rules/**`
* `rules-singbox/**`
* `scripts/generate-singbox-rules.mjs`
* `scripts/generate-singbox-srs.sh`
* `package.json`

它会：

* 下载 sing-box
* 生成 `rules-singbox/*.json`
* 编译 `rules-singbox-srs/*.srs`
* 自动提交生成结果

也可以在 GitHub Actions 页面手动触发。

### Deploy Worker

[deploy.yaml](./.github/workflows/deploy.yaml) 用于部署 Cloudflare Worker。

需要在 GitHub 仓库添加 Secrets：

* `CLOUDFLARE_API_TOKEN`
* `CLOUDFLARE_ACCOUNT_ID`

---

## Cloudflare Worker

仓库提供一个 Worker 示例：

* [worker.js](./worker.js)：入口
* [stashify.mjs](./stashify.mjs)：转换逻辑

功能：

* 接收订阅链接
* 返回已经替换好 `订阅一` 的 `my-clash-rule.yaml`
* 可选转换成兼容 Stash 的 YAML
* 可选给 YAML 里的 GitHub 资源地址加上 `ghproxy` 前缀

请求参数：

* `sub`：订阅链接，必填
* `target=stash` / `format=stash` / `stash=1`：输出 Stash 兼容版 YAML
* `provider=1`：返回 `proxies:` 节点，内部使用
* `ghproxy`：是否启用 GitHub 加速，支持 `1/true/yes/on`

示例：

```text
https://your-worker.workers.dev/?sub=https%3A%2F%2Fexample.com%2Fsubscribe&ghproxy=1
https://your-worker.workers.dev/?sub=https%3A%2F%2Fexample.com%2Fsubscribe&target=stash
```

本地部署：

```bash
npm install -g wrangler
wrangler login
wrangler deploy
```
