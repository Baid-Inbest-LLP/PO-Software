const { PNG } = require('pngjs');
const jpegDecode = require('jpeg-js').decode;

const MAX_BYTES = 1024 * 1024; // 1 MB decoded

const transparentizeSignaturePng = (buffer) => {
  const png = PNG.sync.read(buffer);
  const threshold = 45;
  for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i];
    const g = png.data[i + 1];
    const b = png.data[i + 2];
    if (r <= threshold && g <= threshold && b <= threshold) {
      png.data[i + 3] = 0;
    }
  }
  return PNG.sync.write(png);
};

const parseUploadToBuffer = (input) => {
  const raw = String(input || '').trim();
  if (!raw) return null;

  const dataUrlMatch = raw.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
  if (dataUrlMatch) {
    return Buffer.from(dataUrlMatch[2], 'base64');
  }
  if (/^[A-Za-z0-9+/=]+$/.test(raw) && raw.length > 32) {
    return Buffer.from(raw, 'base64');
  }
  throw new Error('Signature must be a PNG or JPEG image');
};

const bufferToPng = (buffer) => {
  if (buffer.length > MAX_BYTES) {
    throw new Error('Signature image is too large (max 1 MB)');
  }

  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50;
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8;

  if (isPng) {
    return transparentizeSignaturePng(buffer);
  }
  if (isJpeg) {
    const decoded = jpegDecode(buffer, { useTArray: true });
    const png = new PNG({ width: decoded.width, height: decoded.height });
    png.data = Buffer.from(decoded.data);
    return transparentizeSignaturePng(PNG.sync.write(png));
  }

  throw new Error('Signature must be a PNG or JPEG image');
};

/** Returns base64 PNG string (no data-URI prefix) for MongoDB storage. */
const processSignatureUpload = (input) => {
  if (input === undefined) return undefined;
  if (input === null || input === '') return '';
  const buffer = parseUploadToBuffer(input);
  if (!buffer) return '';
  const png = bufferToPng(buffer);
  return png.toString('base64');
};

const signatureBase64ToDataUri = (base64) => {
  const cleaned = String(base64 || '').trim();
  if (!cleaned) return '';
  return `data:image/png;base64,${cleaned}`;
};

const signatureBase64ToBuffer = (base64) => {
  const cleaned = String(base64 || '').trim();
  if (!cleaned) return null;
  try {
    return Buffer.from(cleaned, 'base64');
  } catch {
    return null;
  }
};

module.exports = {
  processSignatureUpload,
  signatureBase64ToDataUri,
  signatureBase64ToBuffer,
  transparentizeSignaturePng,
};
