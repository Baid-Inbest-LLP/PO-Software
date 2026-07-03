/**
 * Puppeteer configuration — skip bundled Chromium download.
 *
 * On Vercel (and other serverless/CI environments) we use @sparticuz/chromium via
 * puppeteer-core, so the full puppeteer Chromium (~200 MB) is never needed.
 * Skipping it avoids build timeouts and keeps the function bundle within Vercel limits.
 *
 * For local development, install Chrome/Chromium separately and set the
 * PUPPETEER_EXECUTABLE_PATH environment variable if it is not on the default path.
 */
module.exports = {
  skipDownload: true,
};
