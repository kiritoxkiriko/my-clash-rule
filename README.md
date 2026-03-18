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

## 覆写示例

只覆写 `订阅一` 的例子见 [examples/override-sub1.yaml](./examples/override-sub1.yaml)。

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
