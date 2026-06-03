import {
  convertMihomoToStash,
  convertSubscriptionToStashProxySet,
} from "./stashify.mjs";

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

function shouldUseStash(url) {
  const target = url.searchParams.get("target");
  const format = url.searchParams.get("format");
  const type = url.searchParams.get("type");
  const stash = url.searchParams.get("stash");

  if (isTrue(stash)) {
    return true;
  }

  return [target, format, type].some(
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

function getIndexHtml(requestUrl) {
  const baseUrl = new URL(requestUrl);
  baseUrl.search = "";
  baseUrl.hash = "";

  return String.raw`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>订阅链接生成器</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
          "Segoe UI", sans-serif;
        background: #0f172a;
        color: #e2e8f0;
      }

      * {
        box-sizing: border-box;
      }

      body {
        min-height: 100vh;
        margin: 0;
        display: grid;
        place-items: center;
        padding: 24px;
        background:
          radial-gradient(circle at top left, rgba(59, 130, 246, 0.35), transparent 35%),
          radial-gradient(circle at bottom right, rgba(14, 165, 233, 0.24), transparent 35%),
          #0f172a;
      }

      main {
        width: min(100%, 720px);
        padding: 32px;
        border: 1px solid rgba(148, 163, 184, 0.25);
        border-radius: 24px;
        background: rgba(15, 23, 42, 0.82);
        box-shadow: 0 24px 80px rgba(2, 6, 23, 0.45);
        backdrop-filter: blur(18px);
      }

      h1 {
        margin: 0 0 8px;
        font-size: clamp(28px, 5vw, 42px);
        letter-spacing: -0.04em;
      }

      p {
        margin: 0 0 28px;
        color: #94a3b8;
        line-height: 1.7;
      }

      label {
        display: block;
        margin-bottom: 8px;
        font-weight: 700;
      }

      input[type="url"],
      input[type="text"],
      select {
        width: 100%;
        padding: 12px 14px;
        border: 1px solid rgba(148, 163, 184, 0.36);
        border-radius: 14px;
        background: rgba(15, 23, 42, 0.72);
        color: inherit;
        font: inherit;
        outline: none;
      }

      input:focus,
      select:focus {
        border-color: #38bdf8;
        box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.18);
      }

      .field {
        margin-bottom: 20px;
      }

      .row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 14px;
        align-items: end;
      }

      .checkbox {
        display: flex;
        gap: 10px;
        align-items: center;
        margin-bottom: 22px;
        color: #cbd5e1;
      }

      .checkbox input {
        width: 18px;
        height: 18px;
      }

      button,
      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 46px;
        padding: 0 18px;
        border: 0;
        border-radius: 14px;
        background: linear-gradient(135deg, #38bdf8, #2563eb);
        color: white;
        font: inherit;
        font-weight: 800;
        text-decoration: none;
        cursor: pointer;
        white-space: nowrap;
      }

      button.secondary {
        background: rgba(148, 163, 184, 0.18);
        color: #e2e8f0;
      }

      .result-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 12px;
      }

      .hint {
        margin-top: 18px;
        color: #94a3b8;
        font-size: 14px;
      }

      @media (max-width: 640px) {
        main {
          padding: 24px;
        }

        .row {
          grid-template-columns: 1fr;
        }

        button,
        .button {
          width: 100%;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>订阅链接生成器</h1>
      <p>填入你的机场订阅地址，选择输出类型，即可生成当前 Worker 的订阅转换链接。</p>

      <form id="builder">
        <div class="field">
          <label for="sub">订阅地址</label>
          <input id="sub" name="sub" type="url" placeholder="https://example.com/subscribe" required />
        </div>

        <div class="field">
          <label for="type">Type</label>
          <select id="type" name="type">
            <option value="mihomo">mihomo / Clash Meta</option>
            <option value="stash">Stash</option>
          </select>
        </div>

        <label class="checkbox">
          <input id="ghproxy" name="ghproxy" type="checkbox" />
          给 GitHub 资源地址添加 ghproxy 加速前缀
        </label>

        <button type="submit">生成链接</button>
      </form>

      <div class="field" style="margin-top: 26px;">
        <label for="result">生成结果</label>
        <div class="row">
          <input id="result" type="text" readonly placeholder="生成后的订阅链接会显示在这里" />
          <button id="copy" class="secondary" type="button">复制</button>
        </div>
        <div class="result-actions">
          <a id="open" class="button" href="#" target="_blank" rel="noreferrer">打开订阅</a>
        </div>
        <div class="hint">也可以直接用参数访问：<code>?sub=你的订阅地址&type=stash</code>。</div>
      </div>
    </main>

    <script>
      const baseUrl = ${JSON.stringify(baseUrl.toString())};
      const form = document.querySelector("#builder");
      const result = document.querySelector("#result");
      const openLink = document.querySelector("#open");
      const copyButton = document.querySelector("#copy");

      function buildUrl() {
        const generated = new URL(baseUrl);
        const data = new FormData(form);
        generated.searchParams.set("sub", data.get("sub"));
        generated.searchParams.set("type", data.get("type"));

        if (data.get("ghproxy") === "on") {
          generated.searchParams.set("ghproxy", "1");
        }

        return generated.toString();
      }

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const link = buildUrl();
        result.value = link;
        openLink.href = link;
      });

      copyButton.addEventListener("click", async () => {
        if (!result.value) {
          return;
        }

        await navigator.clipboard.writeText(result.value);
        copyButton.textContent = "已复制";
        setTimeout(() => {
          copyButton.textContent = "复制";
        }, 1400);
      });
    </script>
  </body>
</html>`;
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
      return new Response(getIndexHtml(request.url), {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
        },
      });
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
