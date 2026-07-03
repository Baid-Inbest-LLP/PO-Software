/**
 * Embeds static image assets for PDF/Excel (logos + MD signature).
 *
 * Run: npm run generate:embedded-assets
 *
 * The MD signature PNG is transparentized (dark background → transparent) and
 * stored as base64 in embeddedAssets.json/cjs so the Vercel function can access
 * it without reading from disk.  The source Md_SIGN.png is NOT modified in-place
 * so re-running this script produces identical output.
 */
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { transparentizeSignaturePng } = require('../src/utils/assetLoader');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const OUT_JSON = path.join(__dirname, '..', 'src', 'generated', 'embeddedAssets.json');
const OUT_CJS = path.join(__dirname, '..', 'src', 'generated', 'embeddedAssets.cjs');

const LOGO_FILES = ['Inbest_Logo(Blue).png', 'shree_red.png'];
const MD_SIGN = 'Md_SIGN.png';
const FONT_FILES = ['Roboto-Regular.woff2', 'Roboto-Bold.woff2', 'NotoSans-Rupee.woff2'];

function main() {
  const map = {};

  for (const name of LOGO_FILES) {
    const p = path.join(ASSETS_DIR, name);
    if (!fs.existsSync(p)) {
      console.error('[generateEmbeddedAssets] Missing file:', p);
      process.exit(1);
    }
    map[name] = fs.readFileSync(p).toString('base64');
  }

  for (const name of FONT_FILES) {
    const p = path.join(ASSETS_DIR, name);
    if (!fs.existsSync(p)) {
      console.warn('[generateEmbeddedAssets] Font file missing (skipping):', p);
      continue;
    }
    map[name] = fs.readFileSync(p).toString('base64');
  }

  const mdPath = path.join(ASSETS_DIR, MD_SIGN);
  if (!fs.existsSync(mdPath)) {
    console.error('[generateEmbeddedAssets] Missing MD signature:', mdPath);
    process.exit(1);
  }
  const mdRaw = fs.readFileSync(mdPath);
  // Apply transparentize transform for embedding only — do NOT overwrite the source file.
  const mdProcessed = transparentizeSignaturePng(mdRaw);
  map[MD_SIGN] = mdProcessed.toString('base64');

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  const json = JSON.stringify(map);
  fs.writeFileSync(OUT_JSON, json);
  const cjs = `'use strict';\nmodule.exports = ${json};\n`;
  fs.writeFileSync(OUT_CJS, cjs);
  const kb = Math.round(fs.statSync(OUT_JSON).size / 1024);
  console.log(
    '[generateEmbeddedAssets] Wrote',
    Object.keys(map).length,
    'assets to',
    OUT_JSON,
    `(${kb} KB)`,
  );
}

main();
