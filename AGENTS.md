# Repository Notes

This repository maintains personal routing templates for Clash Meta/mihomo, Stash, and sing-box.

## Important Files

* `my-clash-rule.yaml`: primary mihomo / Clash Meta template.
* `my-stash-rule.yaml`: static Stash-compatible template.
* `my-singbox-rule.json`: static sing-box template.
* `rules/*.list`: source rule lists shared by Clash/Stash and converted for sing-box.
* `rules-singbox/*.json`: generated sing-box source rule-sets.
* `rules-singbox-srs/*.srs`: generated sing-box binary rule-sets used by `my-singbox-rule.json`.
* `scripts/generate-singbox-rules.mjs`: converts Clash list rules to sing-box source rule-set JSON.
* `scripts/generate-singbox-srs.sh`: compiles sing-box source rule-set JSON to `.srs`.
* `worker.js` and `stashify.mjs`: Cloudflare Worker and Stash conversion logic.

## Maintenance Rules

* Keep edits scoped. Do not rewrite unrelated proxy group ordering unless asked.
* `rules-singbox/` and `rules-singbox-srs/` are generated but intentionally committed.
* Do not put `GEOSITE` or `GEOIP` into sing-box source rule-set JSON. sing-box rejects those fields in source rule-sets; use remote `.srs` rule-sets in `my-singbox-rule.json`.
* If `rules/*.list` changes, regenerate both sing-box outputs:

```bash
npm run generate:singbox-rules
npm run generate:singbox-srs
```

* `generate:singbox-srs` requires `sing-box` to be installed locally.

## Proxy Group Conventions

* Normal region groups are manual selection:
  * `HK`
  * `JP`
  * `US`
  * `TW`
  * `SG`
  * `KR`
* Advance region groups are automatic latency tests:
  * `HK-Advance`
  * `JP-Advance`
  * `US-Advance`
* When a group includes both a normal region and its Advance variant, the Advance variant should come first.
* Do not reintroduce the global `Auto` group unless explicitly requested.
* Top-level policy groups such as `AI`, `Netflix`, `Disney`, `Proxy`, and `Final` should remain manual `select` groups unless explicitly requested otherwise.

## DNS Conventions

* Clash and Stash templates use DoT, not DoH.
* sing-box DNS tags:
  * `local`: system resolver
  * `local-119`: `119.29.29.29`
  * `local-223`: `223.5.5.5`
  * `remote`: `1.1.1.1`
  * `remote-8`: `8.8.8.8`
* Local/direct DNS rules should prefer `local`; the default should remain `remote`.

## Validation

Run these after edits:

```bash
ruby -e "require 'yaml'; YAML.load_file('my-clash-rule.yaml'); YAML.load_file('my-stash-rule.yaml')"
sing-box check -c my-singbox-rule.json
```

When sing-box rule-sets change:

```bash
npm run generate:singbox-rules
npm run generate:singbox-srs
```

Optional reference check for sing-box outbounds:

```bash
node - <<'NODE'
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('my-singbox-rule.json', 'utf8'));
const tags = new Set(config.outbounds.map((outbound) => outbound.tag));
const missing = [];
for (const outbound of config.outbounds) {
  for (const tag of outbound.outbounds || []) {
    if (!tags.has(tag)) missing.push(`${outbound.tag} -> ${tag}`);
  }
}
if (missing.length) {
  console.error(missing.join('\n'));
  process.exit(1);
}
console.log('singbox outbound refs ok');
NODE
```

## GitHub Actions

* `.github/workflows/build-singbox-rules.yml` regenerates and commits sing-box JSON/SRS rule-sets.
* `.github/workflows/deploy.yaml` deploys the Cloudflare Worker and requires Cloudflare secrets.
