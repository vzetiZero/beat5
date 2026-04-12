const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

function parseArgs(argv) {
  const result = {
    url: "",
    outDir: path.join(process.cwd(), "tmp", "parsed-ui"),
    jsDir: "",
    waitSelector: "",
    timeout: 30000,
    headless: true
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--url" && next) {
      result.url = next;
      index += 1;
      continue;
    }
    if (arg === "--outDir" && next) {
      result.outDir = path.resolve(next);
      index += 1;
      continue;
    }
    if (arg === "--jsDir" && next) {
      result.jsDir = path.resolve(next);
      index += 1;
      continue;
    }
    if (arg === "--waitSelector" && next) {
      result.waitSelector = next;
      index += 1;
      continue;
    }
    if (arg === "--timeout" && next) {
      result.timeout = Number(next) || result.timeout;
      index += 1;
      continue;
    }
    if (arg === "--headed") {
      result.headless = false;
    }
  }

  if (!result.url) {
    throw new Error("Thieu --url. Vi du: node scripts/playwright-parse-html.js --url https://annam.pro/Home");
  }

  return result;
}

function ensureDir(targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
}

function safeFileName(input) {
  return String(input || "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "page";
}

function listLocalJsFiles(jsDir) {
  if (!jsDir || !fs.existsSync(jsDir)) {
    return [];
  }

  const results = [];
  const stack = [jsDir];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name.toLowerCase().endsWith(".js")) {
        results.push({
          name: entry.name,
          fullPath,
          relativePath: path.relative(jsDir, fullPath),
          size: fs.statSync(fullPath).size
        });
      }
    }
  }

  return results.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  ensureDir(options.outDir);

  const browser = await chromium.launch({ headless: options.headless });
  const page = await browser.newPage();

  const requests = [];
  page.on("request", (request) => {
    requests.push({
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType()
    });
  });

  try {
    await page.goto(options.url, {
      waitUntil: "networkidle",
      timeout: options.timeout
    });

    if (options.waitSelector) {
      await page.waitForSelector(options.waitSelector, { timeout: options.timeout });
    }

    const pageUrl = new URL(page.url());
    const slug = safeFileName(`${pageUrl.hostname}${pageUrl.pathname}`);
    const htmlPath = path.join(options.outDir, `${slug}.rendered.html`);
    const sourcePath = path.join(options.outDir, `${slug}.source.html`);
    const manifestPath = path.join(options.outDir, `${slug}.manifest.json`);
    const screenshotPath = path.join(options.outDir, `${slug}.png`);

    const renderedHtml = await page.content();
    const sourceHtml = await page.evaluate(() => document.documentElement.outerHTML);
    const title = await page.title();

    const assetData = await page.evaluate(() => {
      const toAbsolute = (value) => {
        try {
          return new URL(value, window.location.href).toString();
        } catch (_error) {
          return value;
        }
      };

      const scripts = Array.from(document.querySelectorAll("script[src]")).map((element) => ({
        src: toAbsolute(element.getAttribute("src") || ""),
        type: element.getAttribute("type") || ""
      }));

      const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((element) => ({
        href: toAbsolute(element.getAttribute("href") || "")
      }));

      const images = Array.from(document.querySelectorAll("img[src]")).map((element) => ({
        src: toAbsolute(element.getAttribute("src") || ""),
        alt: element.getAttribute("alt") || ""
      }));

      return {
        htmlClassName: document.documentElement.className || "",
        bodyClassName: document.body ? document.body.className || "" : "",
        scripts,
        stylesheets,
        images
      };
    });

    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });

    fs.writeFileSync(htmlPath, renderedHtml, "utf8");
    fs.writeFileSync(sourcePath, sourceHtml, "utf8");

    const manifest = {
      capturedAt: new Date().toISOString(),
      input: {
        url: options.url,
        jsDir: options.jsDir || null,
        waitSelector: options.waitSelector || null
      },
      page: {
        finalUrl: page.url(),
        title
      },
      dom: assetData,
      network: {
        totalRequests: requests.length,
        scripts: requests.filter((item) => item.resourceType === "script"),
        stylesheets: requests.filter((item) => item.resourceType === "stylesheet"),
        documents: requests.filter((item) => item.resourceType === "document"),
        xhrAndFetch: requests.filter((item) => item.resourceType === "xhr" || item.resourceType === "fetch")
      },
      localJsFiles: listLocalJsFiles(options.jsDir),
      outputs: {
        renderedHtml: htmlPath,
        sourceHtml: sourcePath,
        screenshot: screenshotPath
      }
    };

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

    console.log("PLAYWRIGHT_PARSE_HTML: PASS");
    console.log(`URL: ${options.url}`);
    console.log(`Rendered HTML: ${htmlPath}`);
    console.log(`Source HTML: ${sourcePath}`);
    console.log(`Manifest: ${manifestPath}`);
    console.log(`Screenshot: ${screenshotPath}`);
    console.log(`Local JS files: ${manifest.localJsFiles.length}`);
  } finally {
    await page.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error("PLAYWRIGHT_PARSE_HTML: FAIL");
  console.error(error);
  process.exit(1);
});
