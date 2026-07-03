const chromium = require("@sparticuz/chromium");
const puppeteerCore = require("puppeteer-core");

let browserPromise = null;
const usePackagedChromium = Boolean(process.env.VERCEL || process.env.RENDER);

/**
 * Resolve the Chrome/Chromium executable path for local development.
 * Checks PUPPETEER_EXECUTABLE_PATH env var first, then falls back to
 * puppeteer-core's bundled finder or common system paths.
 */
function getLocalChromePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH)
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  // Common paths for Windows / Linux / macOS
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];
  const fs = require("fs");
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* next */
    }
  }
  return undefined;
}

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = (async () => {
      if (usePackagedChromium) {
        const executablePath = await chromium.executablePath();
        return puppeteerCore.launch({
          args: chromium.args,
          defaultViewport: chromium.defaultViewport,
          executablePath,
          headless: chromium.headless,
        });
      }

      // Local development: puppeteer's bundled Chromium is skipped (.puppeteerrc.cjs skipDownload).
      // Use puppeteer-core with the system Chrome instead.
      const executablePath = getLocalChromePath();
      return puppeteerCore.launch({
        headless: true,
        executablePath,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
        ],
      });
    })();
  }
  return browserPromise;
}

// Pre-warm only outside serverless runtimes.
if (!usePackagedChromium) {
  getBrowser().catch((err) => {
    console.error("Failed to pre-warm Puppeteer:", err);
    browserPromise = null;
  });
}

// Ensure Chromium is cleaned up on shutdown (prevents zombie Chromium processes).
const shutdown = async () => {
  try {
    if (!browserPromise) return;
    const browser = await browserPromise;
    if (browser && browser.close) await browser.close();
  } catch (err) {
    // Ignore shutdown errors
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function renderHtmlToPdfBuffer(
  html,
  { headerHtml = "", footerHtml = "" } = {},
) {
  const browser = await getBrowser();
  let page;
  try {
    page = await browser.newPage();
    // The PDF template is self-contained (assets are inlined as data URIs),
    // so waiting for network idle only slows things down (and can block on external fonts).
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    // Data-URI images can decode after DCL; wait so PDF paint includes all <img> (stamps, logos).
    await page
      .evaluate(() =>
        Promise.all(
          [...document.images].map(
            (img) =>
              new Promise((resolve) => {
                if (img.complete) {
                  resolve();
                  return;
                }
                img.addEventListener("load", () => resolve());
                img.addEventListener("error", () => resolve());
              }),
          ),
        ),
      )
      .catch(() => {});

    const useNativeTemplates = Boolean(headerHtml || footerHtml);
    const buffer = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: useNativeTemplates,
      headerTemplate: useNativeTemplates ? (headerHtml || "<div></div>") : undefined,
      footerTemplate: useNativeTemplates ? (footerHtml || "<div></div>") : undefined,
      margin: {
        top: useNativeTemplates ? "86mm" : "0mm",
        bottom: useNativeTemplates ? "12mm" : "0mm",
        right: "0",
        left: "0",
      },
    });

    return buffer;
  } finally {
    if (page) await page.close();
  }
}

module.exports = { renderHtmlToPdfBuffer };
