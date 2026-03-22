import YAML from "yaml";

const DEFAULT_DNS = {
  "default-nameserver": ["223.5.5.5", "114.114.114.114"],
  nameserver: ["https://doh.pub/dns-query", "https://dns.alidns.com/dns-query"],
};

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
  if (Array.isArray(value)) {
    return value;
  }
  return fallback;
}

function normalizeDnsSection(dns) {
  const source = isPlainObject(dns) ? deepClone(dns) : {};

  const defaultNameserver = ensureArray(
    source["default-nameserver"],
    DEFAULT_DNS["default-nameserver"]
  );

  const nameserver = ensureArray(source.nameserver, DEFAULT_DNS.nameserver);

  source["default-nameserver"] =
    defaultNameserver.length > 0
      ? defaultNameserver
      : DEFAULT_DNS["default-nameserver"];

  source.nameserver =
    nameserver.length > 0 ? nameserver : DEFAULT_DNS.nameserver;

  return source;
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

    // 完整保留 provider 字段，不再只摘 url / interval / filter
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

    // 先完整保留，避免误删 type/path 等关键字段
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

      // 这里不再根据 name 猜 type，也不再只识别 "<<: *use"
      // 因为 YAML merge 在 parse 阶段已经展开了
      //
      // 可选兜底：
      // 某些模板里 group 依赖 use anchor，但 merge 后如果 use 丢了，
      // 且原意明显是 provider group，可以按需补 provider 名称。
      if (
        !Array.isArray(next.use) &&
        !Array.isArray(next.proxies) &&
        proxyProviderNames.length > 0 &&
        (next.type === "select" ||
          next.type === "url-test" ||
          next.type === "fallback" ||
          next.type === "load-balance")
      ) {
        // 不强补，避免误伤本来就是纯 proxies 组的情况
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
  const dns = normalizeDnsSection(config.dns);
  const rules = normalizeRules(config.rules);

  const output = {
    ...pickTopLevelFields(config),
    dns,
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

export function convertSubscriptionToStashProxySet(yamlText) {
  const source = parseYamlToObject(yamlText);
  const proxies = ensureArray(source?.proxies);

  if (proxies.length === 0) {
    return null;
  }

  return YAML.stringify(
    {
      proxies: deepClone(proxies),
    },
    {
      lineWidth: 0,
      indent: 2,
    }
  );
}

export function convertMihomoToStash(yamlText) {
  const source = parseYamlToObject(yamlText);
  const output = buildStashConfigObject(source);

  const header = [
    "# Generated from mihomo / Clash Meta template for Stash",
    "# This version uses a real YAML parser and preserves fields whenever possible.",
    "",
  ].join("\n");

  return (
    header +
    YAML.stringify(output, {
      lineWidth: 0,
      indent: 2,
    })
  );
}
