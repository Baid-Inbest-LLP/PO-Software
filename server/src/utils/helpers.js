/** Uppercase A–Z / 0–9 only, for compact PO tokens; empty → LOC */
const sanitizePoToken = (raw) => {
  const s = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s || 'LOC';
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * PO number: {location}/PO/{yy}-{yy}/{MM}/{seq}
 * Indian FY Apr–Mar on yy-yy; MM = calendar month (01–12).
 * Example: MAIN/PO/26-27/04/01
 */
const generatePONumber = async (PurchaseOrder, locationLabel) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based

  const fyStart = month >= 3 ? year : year - 1;
  const fyEnd = fyStart + 1;
  const fyShort = `${String(fyStart).slice(-2)}-${String(fyEnd).slice(-2)}`;

  const monthNum = String(month + 1).padStart(2, '0');
  const loc = sanitizePoToken(locationLabel);

  const prefix = `${loc}/PO/${fyShort}/${monthNum}/`;

  const lastPO = await PurchaseOrder.findOne(
    { poNumber: new RegExp(`^${escapeRegex(prefix)}`) },
    {},
    { sort: { createdAt: -1 } }
  );

  let sequence = 1;
  if (lastPO && typeof lastPO.poNumber === 'string' && lastPO.poNumber.startsWith(prefix)) {
    const suffix = lastPO.poNumber.slice(prefix.length);
    const lastSeq = parseInt(suffix, 10);
    if (!isNaN(lastSeq)) sequence = lastSeq + 1;
  }

  return `${prefix}${String(sequence).padStart(2, '0')}`;
};

const signToken = (id) => {
  const jwt = require('jsonwebtoken');
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

const sendTokenResponse = (user, statusCode, res) => {
  const token = signToken(user._id);
  const hasAvatar = Boolean(user.avatarImage);

  res.status(statusCode).json({
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      company: user.company,
      hasAvatar,
    },
  });
};

module.exports = { generatePONumber, signToken, sendTokenResponse };
