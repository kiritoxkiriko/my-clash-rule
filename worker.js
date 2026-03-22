import {
  convertMihomoToStash,
  convertSubscriptionToStashProxySet,
} from "./stashify.mjs";

const RULE_URL =
  "https://raw.githubusercontent.com/kiritoxkiriko/my-clash-rule/refs/heads/main/my-clash-rule.yaml";
const GHPROXY_URL = "https://gh.sqlboy.me";

const GITHUB_URL_RE =
  /https:\/\/(?:raw\.githubusercontent\.com|github\.com|gist\.githubusercontent\.com)\/[^\s"')]+/g;

function isTrue(value) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

function shouldUseStash(url) {
  const target = url.searchParams.get("target");
  const format = url.searchParams.get("format");
  const stash = url.searchParams.get("stash");

  if (isTrue(stash)) {
    return true;
  }

  return [target, format].some(
    (value) => typeof value === "string" && value.trim().toLowerCase() === "stash",
  );
}

function shouldReturnProxyProvider(url) {
  return isTrue(url.searchParams.get("provider"));
}

function buildProxyProviderUrl(requestUrl, subscriptionUrl) {
  const providerUrl = new URL(requestUrl);
  providerUrl.search = "";
  providerUrl.searchParams.set("provider", "1");
  providerUrl.searchParams.set("sub", subscriptionUrl);
  return providerUrl.toString();
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

async function fetchText(targetUrl) {
  const response = await fetch(targetUrl, {
    headers: {
      "user-agent": "my-clash-rule-worker",
    },
  });

  if (!response.ok) {
    throw new Error(`upstream responded with ${response.status}`);
  }

  return response.text();
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const subscriptionUrl = url.searchParams.get("sub");
    const useGhproxy = isTrue(url.searchParams.get("ghproxy"));
    const useStash = shouldUseStash(url);
    const returnProxyProvider = shouldReturnProxyProvider(url);

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

    try {
      if (returnProxyProvider) {
        const subscriptionText = await fetchText(subscriptionUrl);
        const proxySetYaml = convertSubscriptionToStashProxySet(subscriptionText);

        if (!proxySetYaml) {
          return new Response(
            [
              "failed to build stash proxy-provider from subscription",
              "upstream content does not contain a top-level `proxies:` field",
            ].join("\n"),
            {
              status: 502,
              headers: { "content-type": "text/plain; charset=utf-8" },
            },
          );
        }

        return new Response(proxySetYaml, {
          headers: {
            "content-type": "application/yaml; charset=utf-8",
            "cache-control": "no-store",
          },
        });
      }
    } catch (error) {
      return new Response(`failed to fetch subscription: ${error.message}`, {
        status: 502,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    let yamlText;
    try {
      yamlText = await fetchText(RULE_URL);
    } catch (error) {
      return new Response(`failed to fetch rule template: ${error.message}`, {
        status: 502,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    const rewrittenSubscriptionUrl = useStash
      ? buildProxyProviderUrl(request.url, subscriptionUrl)
      : subscriptionUrl;
    yamlText = replaceSubscriptionUrl(yamlText, rewrittenSubscriptionUrl);

    if (useStash) {
      yamlText = convertMihomoToStash(yamlText);
    }

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
