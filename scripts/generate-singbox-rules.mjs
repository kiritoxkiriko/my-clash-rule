import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const RULES_DIR = "rules";
const OUTPUT_DIR = "rules-singbox";
const RULE_SET_VERSION = 3;

const LIST_RULE_TO_SING_BOX_FIELD = {
  DOMAIN: "domain",
  "DOMAIN-SUFFIX": "domain_suffix",
  "DOMAIN-KEYWORD": "domain_keyword",
  "DOMAIN-REGEX": "domain_regex",
  "IP-CIDR": "ip_cidr",
  "IP-CIDR6": "ip_cidr",
  "SRC-IP-CIDR": "source_ip_cidr",
  "SRC-IP-CIDR6": "source_ip_cidr",
  "DST-PORT": "port",
  "SRC-PORT": "source_port",
  "PROCESS-NAME": "process_name",
  "PROCESS-PATH": "process_path",
  NETWORK: "network",
};

const NUMERIC_FIELDS = new Set(["port", "source_port"]);

function pushRuleValue(rule, field, value) {
  if (NUMERIC_FIELDS.has(field) && /^\d+$/.test(value)) {
    value = Number(value);
  }

  if (!rule[field]) {
    rule[field] = [];
  }

  rule[field].push(value);
}

function parseRuleLine(line) {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const commentIndex = trimmed.indexOf(" #");
  const withoutComment =
    commentIndex === -1 ? trimmed : trimmed.slice(0, commentIndex).trim();
  const [type, value] = withoutComment.split(",", 2);

  if (!type || !value) {
    return null;
  }

  return {
    type: type.trim().toUpperCase(),
    value: value.trim(),
  };
}

function convertListToRuleSet(listText) {
  const rule = {};
  const unsupported = new Map();

  for (const line of listText.split(/\r?\n/)) {
    const parsed = parseRuleLine(line);
    if (!parsed) {
      continue;
    }

    const field = LIST_RULE_TO_SING_BOX_FIELD[parsed.type];
    if (!field) {
      unsupported.set(parsed.type, (unsupported.get(parsed.type) || 0) + 1);
      continue;
    }

    pushRuleValue(rule, field, parsed.value);
  }

  const rules = Object.keys(rule).length > 0 ? [rule] : [];
  return {
    ruleSet: {
      version: RULE_SET_VERSION,
      rules,
    },
    unsupported,
  };
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const entries = await readdir(RULES_DIR);
  const listFiles = entries
    .filter((entry) => entry.endsWith(".list"))
    .sort((a, b) => a.localeCompare(b));

  const warnings = [];

  for (const fileName of listFiles) {
    const sourcePath = path.join(RULES_DIR, fileName);
    const outputPath = path.join(
      OUTPUT_DIR,
      fileName.replace(/\.list$/, ".json"),
    );

    const source = await readFile(sourcePath, "utf8");
    const { ruleSet, unsupported } = convertListToRuleSet(source);

    await writeFile(outputPath, `${JSON.stringify(ruleSet, null, 2)}\n`);

    if (unsupported.size > 0) {
      warnings.push(
        `${fileName}: ${Array.from(unsupported)
          .map(([type, count]) => `${type} x${count}`)
          .join(", ")}`,
      );
    }
  }

  if (warnings.length > 0) {
    console.warn(
      [
        "Some Clash rule types are not supported by sing-box source rule-sets.",
        "They should be handled in my-singbox-rule.json via remote SRS rule-sets:",
        ...warnings.map((warning) => `- ${warning}`),
      ].join("\n"),
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
