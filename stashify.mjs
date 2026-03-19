function splitLines(yamlText) {
  return yamlText.replace(/\r\n/g, "\n").split("\n");
}

function findTopLevelSectionRange(lines, sectionName) {
  const header = `${sectionName}:`;
  const start = lines.findIndex((line) => line.trimEnd() === header);

  if (start === -1) {
    return null;
  }

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^[A-Za-z0-9_-]+:\s*(?:.*)?$/.test(lines[i])) {
      end = i;
      break;
    }
  }

  return { start, end };
}

function getTopLevelSectionLines(yamlText, sectionName) {
  const lines = splitLines(yamlText);
  const range = findTopLevelSectionRange(lines, sectionName);
  if (!range) {
    return null;
  }

  return lines.slice(range.start, range.end);
}

function getTopLevelSectionBlock(yamlText, sectionName) {
  const lines = getTopLevelSectionLines(yamlText, sectionName);
  return lines ? lines.join("\n") : null;
}

function getTopLevelScalar(yamlText, key) {
  const match = yamlText.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  return match ? match[1].trim() : null;
}

function cleanQuotedValue(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function normalizeDnsServer(value) {
  return value.replace(/#.*$/, "").trim();
}

function quoteYamlString(value) {
  return JSON.stringify(String(value));
}

function parseListItems(sectionLines, key) {
  const start = sectionLines.findIndex((line) => line.trimEnd() === `${key}:`);
  if (start === -1) {
    return [];
  }

  const values = [];
  for (let i = start + 1; i < sectionLines.length; i += 1) {
    const line = sectionLines[i];

    if (/^  [A-Za-z0-9_-]+:\s*/.test(line)) {
      break;
    }

    const match = line.match(/^    -\s+(.+?)\s*$/);
    if (match) {
      values.push(cleanQuotedValue(match[1]));
    }
  }

  return values;
}

function parseMappingBlock(sectionLines, key) {
  const start = sectionLines.findIndex((line) => line.trimEnd() === `${key}:`);
  if (start === -1) {
    return [];
  }

  const values = [];
  for (let i = start + 1; i < sectionLines.length; i += 1) {
    const line = sectionLines[i];

    if (/^  [A-Za-z0-9_-]+:\s*/.test(line)) {
      break;
    }

    values.push(line);
  }

  return values;
}

function parseProxyProviders(yamlText) {
  const lines = getTopLevelSectionLines(yamlText, "proxy-providers") || [];
  const providers = [];
  let current = null;

  function flushCurrent() {
    if (current && current.url) {
      providers.push(current);
    }
  }

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    const providerMatch = line.match(/^  ([^#\s][^:]*):\s*$/);

    if (providerMatch) {
      flushCurrent();
      current = {
        name: providerMatch[1],
        interval: "86400",
      };
      continue;
    }

    if (!current) {
      continue;
    }

    let match = line.match(/^    url:\s*(.+?)\s*$/);
    if (match) {
      current.url = cleanQuotedValue(match[1]);
      continue;
    }

    match = line.match(/^    interval:\s*(.+?)\s*$/);
    if (match) {
      current.interval = cleanQuotedValue(match[1]);
      continue;
    }

    match = line.match(/^    filter:\s*(.+?)\s*$/);
    if (match) {
      current.filter = match[1].trim();
    }
  }

  flushCurrent();
  return providers;
}

function getProviderNames(yamlText) {
  const providers = parseProxyProviders(yamlText);
  if (providers.length === 0) {
    return ["订阅一"];
  }

  return providers.map((provider) => provider.name);
}

function buildDnsSection(yamlText) {
  const lines = getTopLevelSectionLines(yamlText, "dns") || [];
  const defaultNameserver = parseListItems(lines, "  default-nameserver")
    .map(normalizeDnsServer)
    .filter(Boolean);
  const nameserver = parseListItems(lines, "  nameserver")
    .map(normalizeDnsServer)
    .filter(Boolean);
  const policyLines = parseMappingBlock(lines, "  nameserver-policy");
  const supportedPolicyEntries = [];

  for (let i = 0; i < policyLines.length; i += 1) {
    const line = policyLines[i];
    const match = line.match(/^    (["']?)(.+?)\1:\s*$/);
    if (!match) {
      continue;
    }

    const key = match[2];
    if (key.includes(":")) {
      while (i + 1 < policyLines.length && /^      /.test(policyLines[i + 1])) {
        i += 1;
      }
      continue;
    }

    supportedPolicyEntries.push(line);
    while (i + 1 < policyLines.length && /^      /.test(policyLines[i + 1])) {
      supportedPolicyEntries.push(policyLines[i + 1]);
      i += 1;
    }
  }

  const fallbackDefaultNameserver =
    defaultNameserver.length > 0
      ? defaultNameserver
      : ["223.5.5.5", "114.114.114.114"];
  const fallbackNameserver =
    nameserver.length > 0
      ? nameserver
      : ["https://doh.pub/dns-query", "https://dns.alidns.com/dns-query"];

  const output = [
    "dns:",
    "  default-nameserver:",
    ...fallbackDefaultNameserver.map((value) => `    - ${quoteYamlString(value)}`),
    "  nameserver:",
    ...fallbackNameserver.map((value) => `    - ${quoteYamlString(value)}`),
    "  skip-cert-verify: true",
    "  follow-rule: false",
  ];

  if (supportedPolicyEntries.length > 0) {
    output.push("  nameserver-policy:");
    output.push(...supportedPolicyEntries);
  }

  return output.join("\n");
}

function buildProxyProvidersSection(yamlText) {
  const providers = parseProxyProviders(yamlText);
  if (providers.length === 0) {
    return [
      "proxy-providers:",
      "  订阅一:",
      '    url: "https://example.com/airport?type=stash"',
      "    interval: 86400",
    ].join("\n");
  }

  const output = ["proxy-providers:"];
  for (const provider of providers) {
    output.push(`  ${provider.name}:`);
    output.push(`    url: ${quoteYamlString(provider.url)}`);
    output.push(`    interval: ${provider.interval}`);
    if (provider.filter) {
      output.push(`    filter: ${provider.filter}`);
    }
    output.push("");
  }

  if (output[output.length - 1] === "") {
    output.pop();
  }

  return output.join("\n");
}

function buildRuleProvidersSection(yamlText) {
  const lines = getTopLevelSectionLines(yamlText, "rule-providers") || [];
  if (lines.length === 0) {
    return "rule-providers:";
  }

  const output = [];
  for (const line of lines) {
    if (/^    type:\s*/.test(line) || /^    path:\s*/.test(line)) {
      continue;
    }
    output.push(line);
  }

  return output.join("\n").replace(/\n{3,}/g, "\n\n");
}

function splitProxyGroupBlocks(yamlText) {
  const lines = getTopLevelSectionLines(yamlText, "proxy-groups") || [];
  if (lines.length === 0) {
    return [];
  }

  const blocks = [];
  let current = [];

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^  - name:\s+/.test(line)) {
      if (current.length > 0) {
        blocks.push(current);
      }
      current = [line];
      continue;
    }

    if (current.length > 0) {
      current.push(line);
    }
  }

  if (current.length > 0) {
    blocks.push(current);
  }

  return blocks;
}

function transformUseAnchorGroup(lines, providerNames) {
  const header = lines[0];
  const nameMatch = header.match(/^  - name:\s+(.+?)\s*$/);
  const name = nameMatch ? nameMatch[1].trim() : "";
  const filterLine = lines.find((line) => /^    filter:\s+/.test(line));
  const filterValue = filterLine ? filterLine.replace(/^    filter:\s+/, "") : null;

  if (name === "Auto") {
    return [
      `  - name: ${name}`,
      "    type: url-test",
      "    use:",
      ...providerNames.map((providerName) => `      - ${providerName}`),
      "    interval: 300",
      "    lazy: true",
    ].join("\n");
  }

  const output = [
    `  - name: ${name}`,
    "    type: select",
    "    use:",
    ...providerNames.map((providerName) => `      - ${providerName}`),
  ];

  if (filterValue) {
    output.push(`    filter: ${filterValue}`);
  }

  return output.join("\n");
}

function buildProxyGroupsSection(yamlText) {
  const providerNames = getProviderNames(yamlText);
  const blocks = splitProxyGroupBlocks(yamlText);

  if (blocks.length === 0) {
    return "proxy-groups:";
  }

  const output = ["proxy-groups:"];
  for (const block of blocks) {
    const usesAnchor = block.some((line) => line.includes("<<: *use"));
    if (usesAnchor) {
      output.push(transformUseAnchorGroup(block, providerNames));
    } else {
      output.push(block.join("\n"));
    }
  }

  return output.join("\n");
}

function buildRulesSection(yamlText) {
  return getTopLevelSectionBlock(yamlText, "rules") || "rules:\n  - MATCH,DIRECT";
}

export function convertSubscriptionToStashProxySet(yamlText) {
  const proxiesBlock = getTopLevelSectionBlock(yamlText, "proxies");
  if (!proxiesBlock) {
    return null;
  }

  return `${proxiesBlock.trimEnd()}\n`;
}

export function convertMihomoToStash(yamlText) {
  const mode = getTopLevelScalar(yamlText, "mode") || "rule";
  const ipv6 = getTopLevelScalar(yamlText, "ipv6");
  const logLevel = getTopLevelScalar(yamlText, "log-level") || "info";
  const allowLan = getTopLevelScalar(yamlText, "allow-lan") || "true";
  const mixedPort = getTopLevelScalar(yamlText, "mixed-port") || "7890";

  const output = [
    "# Generated from mihomo / Clash Meta template for Stash",
    "# Keep the original structure where possible and only rewrite incompatible parts.",
    "",
    `mode: ${mode}`,
  ];

  if (ipv6) {
    output.push(`ipv6: ${ipv6}`);
  }

  output.push(`log-level: ${logLevel}`);
  output.push(`allow-lan: ${allowLan}`);
  output.push(`mixed-port: ${mixedPort}`);
  output.push("");
  output.push(buildDnsSection(yamlText));
  output.push("");
  output.push(buildProxyProvidersSection(yamlText));
  output.push("");
  output.push(buildRuleProvidersSection(yamlText));
  output.push("");
  output.push(buildProxyGroupsSection(yamlText));
  output.push("");
  output.push(buildRulesSection(yamlText));
  output.push("");

  return output.join("\n");
}
