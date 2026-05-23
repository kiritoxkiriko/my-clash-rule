import YAML from "yaml";

function parseYamlToObject(yamlText) {
  const doc = YAML.parseDocument(yamlText, {
    merge: true,
    prettyErrors: true,
  });

  if (doc.errors && doc.errors.length > 0) {
    throw new Error(
      `YAML 解析失败:\n${doc.errors.map((e) => e.message).join("\n")}`
    );
  }

  return doc.toJS({
    merge: true,
    maxAliasCount: 1000,
  });
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function removeUndefinedDeep(value) {
  if (Array.isArray(value)) {
    return value
      .map(removeUndefinedDeep)
      .filter((item) => item !== undefined);
  }

  if (isPlainObject(value)) {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      const cleaned = removeUndefinedDeep(val);
      if (cleaned !== undefined) {
        out[key] = cleaned;
      }
    }
    return out;
  }

  return value === undefined ? undefined : value;
}

function ensureArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function normalizeProxyProviders(proxyProviders) {
  if (!isPlainObject(proxyProviders)) {
    return {};
  }

  const output = {};
  for (const [name, provider] of Object.entries(proxyProviders)) {
    if (!isPlainObject(provider)) {
      continue;
    }
    output[name] = deepClone(provider);
  }

  return output;
}

function normalizeRuleProviders(ruleProviders) {
  if (!isPlainObject(ruleProviders)) {
    return {};
  }

  const output = {};
  for (const [name, provider] of Object.entries(ruleProviders)) {
    if (!isPlainObject(provider)) {
      continue;
    }
    output[name] = deepClone(provider);
  }

  return output;
}

function normalizeProxyGroups(proxyGroups, proxyProviderNames) {
  if (!Array.isArray(proxyGroups)) {
    return [];
  }

  return proxyGroups
    .filter((group) => isPlainObject(group))
    .map((group) => {
      const next = deepClone(group);

      // YAML merge / anchor 在 parse 阶段已经展开
      // 这里不再凭 name 猜 type，也不强行改写 group
      if (
        !Array.isArray(next.use) &&
        !Array.isArray(next.proxies) &&
        proxyProviderNames.length > 0 &&
        (next.type === "select" ||
          next.type === "url-test" ||
          next.type === "fallback" ||
          next.type === "load-balance")
      ) {
        // 保守处理：不自动补 use，避免误伤
      }

      return next;
    });
}

function normalizeRules(rules) {
  if (!Array.isArray(rules) || rules.length === 0) {
    return ["MATCH,DIRECT"];
  }
  return deepClone(rules);
}

function pickTopLevelFields(config) {
  const output = {};

  const preferredOrder = [
    "mode",
    "ipv6",
    "log-level",
    "allow-lan",
    "mixed-port",
    "http-port",
    "socks-port",
    "redir-port",
    "tproxy-port",
    "port",
    "bind-address",
    "external-controller",
    "external-ui",
    "secret",
    "unified-delay",
    "tcp-concurrent",
    "find-process-mode",
    "global-client-fingerprint",
    "client-fingerprint",
    "profile",
    "sniffer",
    "hosts",
    "tun",
  ];

  for (const key of preferredOrder) {
    if (config[key] !== undefined) {
      output[key] = deepClone(config[key]);
    }
  }

  return output;
}

function buildStashConfigObject(sourceConfig) {
  const config = isPlainObject(sourceConfig) ? sourceConfig : {};

  const proxyProviders = normalizeProxyProviders(config["proxy-providers"]);
  const ruleProviders = normalizeRuleProviders(config["rule-providers"]);
  const proxyGroups = normalizeProxyGroups(
    config["proxy-groups"],
    Object.keys(proxyProviders)
  );
  const rules = normalizeRules(config.rules);

  const output = {
    ...pickTopLevelFields(config),
  };

  if (Object.keys(proxyProviders).length > 0) {
    output["proxy-providers"] = proxyProviders;
  }

  if (Object.keys(ruleProviders).length > 0) {
    output["rule-providers"] = ruleProviders;
  }

  if (proxyGroups.length > 0) {
    output["proxy-groups"] = proxyGroups;
  }

  output.rules = rules;

  return removeUndefinedDeep(output);
}

function stringifyYaml(value) {
  return YAML.stringify(value, {
    lineWidth: 0,
    indent: 2,
  }).replace(/^---\n/, "");
}

function stringifySection(key, value) {
  if (value === undefined) {
    return "";
  }

  const yaml = stringifyYaml({ [key]: value }).trimEnd();
  return yaml;
}

function getStaticDnsBlock() {
  return String.raw`# DNS partial template
# DNS 服务器配置(可选；若不配置，程序内置的 DNS 服务会被关闭)
dns:
  enable: true
  listen: 0.0.0.0:53
  ipv6: true # 当此选项为 false 时, AAAA 请求将返回空

  # 以下填写的 DNS 服务器将会被用来解析 DNS 服务的域名
  # 仅填写 DNS 服务器的 IP 地址
  default-nameserver:
    - 119.29.29.29
    - 223.5.5.5
    - system
  enhanced-mode: fake-ip # fake-ip 或 redir-host
  fake-ip-range: 198.18.0.1/16 # Fake IP 地址池 (CIDR 形式)
  # use-hosts: true # 查询 hosts 并返回 IP 记录

  # 在以下列表的域名将不会被解析为 fake ip，这些域名相关的解析请求将会返回它们真实的 IP 地址
  fake-ip-filter:
    # 以下域名列表参考自 vernesong/OpenClash 项目，并由 Hackl0us 整理补充
    - '*.lan'
    - '*.localdomain'
    - '*.example'
    - '*.invalid'
    - '*.localhost'
    - '*.test'
    - '*.local'
    - '*.home.arpa'
    - 'time.*.com'
    - 'time.*.gov'
    - 'time.*.edu.cn'
    - 'time.*.apple.com'
    - 'time1.*.com'
    - 'time2.*.com'
    - 'time3.*.com'
    - 'time4.*.com'
    - 'time5.*.com'
    - 'time6.*.com'
    - 'time7.*.com'
    - 'ntp.*.com'
    - 'ntp1.*.com'
    - 'ntp2.*.com'
    - 'ntp3.*.com'
    - 'ntp4.*.com'
    - 'ntp5.*.com'
    - 'ntp6.*.com'
    - 'ntp7.*.com'
    - '*.time.edu.cn'
    - '*.ntp.org.cn'
    - '+.pool.ntp.org'
    - 'time1.cloud.tencent.com'
    - 'music.163.com'
    - '*.music.163.com'
    - '*.126.net'
    - 'musicapi.taihe.com'
    - 'music.taihe.com'
    - 'songsearch.kugou.com'
    - 'trackercdn.kugou.com'
    - '*.kuwo.cn'
    - 'api-jooxtt.sanook.com'
    - 'api.joox.com'
    - 'joox.com'
    - 'y.qq.com'
    - '*.y.qq.com'
    - 'streamoc.music.tc.qq.com'
    - 'mobileoc.music.tc.qq.com'
    - 'isure.stream.qqmusic.qq.com'
    - 'dl.stream.qqmusic.qq.com'
    - 'aqqmusic.tc.qq.com'
    - 'amobile.music.tc.qq.com'
    - '*.xiami.com'
    - '*.music.migu.cn'
    - 'music.migu.cn'
    - '*.msftconnecttest.com'
    - '*.msftncsi.com'
    - 'msftconnecttest.com'
    - 'msftncsi.com'
    - 'localhost.ptlogin2.qq.com'
    - 'localhost.sec.qq.com'
    - '+.srv.nintendo.net'
    - '+.stun.playstation.net'
    - 'xbox.*.microsoft.com'
    - '*.*.xboxlive.com'
    - '+.battlenet.com.cn'
    - '+.wotgame.cn'
    - '+.wggames.cn'
    - '+.wowsgame.cn'
    - '+.wargaming.net'
    - 'proxy.golang.org'
    - 'stun.*.*'
    - 'stun.*.*.*'
    - '+.stun.*.*'
    - '+.stun.*.*.*'
    - '+.stun.*.*.*.*'
    - 'heartbeat.belkin.com'
    - '*.linksys.com'
    - '*.linksyssmartwifi.com'
    - '*.router.asus.com'
    - 'mesu.apple.com'
    - 'swscan.apple.com'
    - 'swquery.apple.com'
    - 'swdownload.apple.com'
    - 'swcdn.apple.com'
    - 'swdist.apple.com'
    - 'lens.l.google.com'
    - 'stun.l.google.com'
    - '+.nflxvideo.net'
    - '*.square-enix.com'
    - '*.finalfantasyxiv.com'
    - '*.ffxiv.com'
    - '*.mcdn.bilivideo.cn'
    - WORKGROUP

  # 支持 UDP / TCP / DoT / DoH 协议的 DNS 服务，可以指明具体的连接端口号。
  # 所有 DNS 请求将会直接发送到服务器，不经过任何代理。
  # Clash 会使用最先获得的解析记录回复 DNS 请求
  nameserver:
    - tls://dot.pub
    - tls://dns.alidns.com
    - system

  # 当 fallback 参数被配置时, DNS 请求将同时发送至上方 nameserver 列表和下方 fallback 列表中配置的所有 DNS 服务器.
  # 当解析得到的 IP 地址的地理位置不是 CN 时，clash 将会选用 fallback 中 DNS 服务器的解析结果。
  # fallback:
  #   - tls://dns.google

  # 如果使用 nameserver 列表中的服务器解析的 IP 地址在下方列表中的子网中，则它们被认为是无效的，
  # Clash 会选用 fallback 列表中配置 DNS 服务器解析得到的结果。
  #
  # 当 fallback-filter.geoip 为 true 且 IP 地址的地理位置为 CN 时，
  # Clash 会选用 nameserver 列表中配置 DNS 服务器解析得到的结果。
  #
  # 当 fallback-filter.geoip 为 false, 如果解析结果不在 fallback-filter.ipcidr 范围内，
  # Clash 总会选用 nameserver 列表中配置 DNS 服务器解析得到的结果。
  #
  # 采取以上逻辑进行域名解析是为了对抗 DNS 投毒攻击。
  fallback-filter:
    geoip: false
    ipcidr:
      - 0.0.0.0/8
      - 10.0.0.0/8
      - 100.64.0.0/10
      - 127.0.0.0/8
      - 169.254.0.0/16
      - 172.16.0.0/12
      - 192.0.0.0/24
      - 192.0.2.0/24
      - 192.88.99.0/24
      - 192.168.0.0/16
      - 198.18.0.0/15
      - 198.51.100.0/24
      - 203.0.113.0/24
      - 224.0.0.0/4
      - 240.0.0.0/4
      - 255.255.255.255/32
    domain:
      - '+.google.com'
      - '+.facebook.com'
      - '+.youtube.com'
      - '+.githubusercontent.com'
      - '+.googlevideo.com'`;
}

function buildFinalYamlString(stashConfig) {
  const parts = [];

  parts.push("# Generated from mihomo / Clash Meta template for Stash");
  parts.push(
    "# DNS section is replaced with a fixed commented template for Stash compatibility."
  );
  parts.push("");

  const topLevelOrderedKeys = [
    "mode",
    "ipv6",
    "log-level",
    "allow-lan",
    "mixed-port",
    "http-port",
    "socks-port",
    "redir-port",
    "tproxy-port",
    "port",
    "bind-address",
    "external-controller",
    "external-ui",
    "secret",
    "unified-delay",
    "tcp-concurrent",
    "find-process-mode",
    "global-client-fingerprint",
    "client-fingerprint",
    "profile",
    "sniffer",
    "hosts",
    "tun",
  ];

  for (const key of topLevelOrderedKeys) {
    if (stashConfig[key] !== undefined) {
      parts.push(stringifySection(key, stashConfig[key]));
      parts.push("");
    }
  }

  parts.push(getStaticDnsBlock());
  parts.push("");

  if (stashConfig["proxy-providers"] !== undefined) {
    parts.push(stringifySection("proxy-providers", stashConfig["proxy-providers"]));
    parts.push("");
  }

  if (stashConfig["rule-providers"] !== undefined) {
    parts.push(stringifySection("rule-providers", stashConfig["rule-providers"]));
    parts.push("");
  }

  if (stashConfig["proxy-groups"] !== undefined) {
    parts.push(stringifySection("proxy-groups", stashConfig["proxy-groups"]));
    parts.push("");
  }

  if (stashConfig.rules !== undefined) {
    parts.push(stringifySection("rules", stashConfig.rules));
    parts.push("");
  }

  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

export function convertSubscriptionToStashProxySet(yamlText) {
  const source = parseYamlToObject(yamlText);
  const proxies = ensureArray(source?.proxies);

  if (proxies.length === 0) {
    return null;
  }

  return stringifyYaml({
    proxies: deepClone(proxies),
  });
}

export function convertMihomoToStash(yamlText) {
  const source = parseYamlToObject(yamlText);
  const stashConfig = buildStashConfigObject(source);
  return buildFinalYamlString(stashConfig);
}
