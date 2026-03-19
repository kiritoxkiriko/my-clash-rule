const RULE_URL =
  "https://raw.githubusercontent.com/kiritoxkiriko/my-clash-rule/refs/heads/main/my-clash-rule.yaml";
const GHPROXY_URL = "https://ghfast.top/";

const GITHUB_URL_RE =
  /https:\/\/(?:raw\.githubusercontent\.com|github\.com|gist\.githubusercontent\.com)\/[^\s"')]+/g;

function isTrue(value) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

function replaceSubscriptionUrl(yamlText, subscriptionUrl) {
  const lines = yamlText.split("\n");
  let inProvider = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (/^  订阅一:\s*$/.test(line)) {
      inProvider = true;
      continue;
    }

    if (inProvider && /^  \S/.test(line) && !/^    /.test(line)) {
      inProvider = false;
    }

    if (inProvider && /^    url:\s*/.test(line)) {
      lines[i] = `    url: ${JSON.stringify(subscriptionUrl)}`;
      break;
    }
  }

  return lines.join("\n");
}

function addGhproxyPrefix(yamlText) {
  return yamlText
    .split("\n")
    .map((line) => {
      if (line.trimStart().startsWith("#")) {
        return line;
      }

      return line.replace(GITHUB_URL_RE, (url) => `${GHPROXY_URL}${url}`);
    })
    .join("\n");
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const subscriptionUrl = url.searchParams.get("sub");
    const useGhproxy = isTrue(url.searchParams.get("ghproxy"));

    if (!subscriptionUrl) {
      return new Response(
        [
          "missing required query param: sub",
          "",
          "example:",
          "?sub=https%3A%2F%2Fexample.com%2Fsubscribe&ghproxy=1",
        ].join("\n"),
        {
          status: 400,
          headers: { "content-type": "text/plain; charset=utf-8" },
        },
      );
    }

    let response;
    try {
      response = await fetch(RULE_URL, {
        headers: {
          "user-agent": "my-clash-rule-worker",
        },
      });
    } catch (error) {
      return new Response(`failed to fetch rule template: ${error.message}`, {
        status: 502,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    if (!response.ok) {
      return new Response(`failed to fetch rule template: ${response.status}`, {
        status: 502,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    let yamlText = await response.text();
    yamlText = replaceSubscriptionUrl(yamlText, subscriptionUrl);

    if (useGhproxy) {
      yamlText = addGhproxyPrefix(yamlText);
    }

    return new Response(yamlText, {
      headers: {
        "content-type": "application/yaml; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  },
};
