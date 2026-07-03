/**
 * Physical address line for PDF/Excel (Ship To, Ship From): street through country only.
 * Omits location label, branch code, company/trading name, etc.
 */
const joinVendorShipFromAddress = (addr) => {
  if (!addr || typeof addr !== 'object') return '';
  const parts = [addr.street, addr.city, addr.state, addr.zipCode, addr.country]
    .map((p) => String(p ?? '').trim())
    .filter(Boolean);
  return parts.join(', ');
};

/**
 * Resolve vendor physical address for a PO: snapshot first, then legacy vendor.address,
 * then location matching vendorLocationId, then default/first location.
 */
const resolvePoVendorPhysical = (po = {}) => {
  const snap = po.vendorAddress;
  if (snap && (String(snap.street || '').trim() || String(snap.city || '').trim())) {
    return snap;
  }
  const vendor = po.vendor || {};
  const legacy = vendor.address;
  if (legacy && (String(legacy.street || '').trim() || String(legacy.city || '').trim())) {
    return legacy;
  }
  const locs = vendor.locations;
  if (!Array.isArray(locs) || locs.length === 0) return null;
  const locId = po.vendorLocationId;
  if (locId) {
    const hit = locs.find((l) => String(l._id) === String(locId));
    if (hit) return hit;
  }
  return locs.find((l) => l.isDefault) || locs[0] || null;
};

const joinPoVendorShipFrom = (po) => joinVendorShipFromAddress(resolvePoVendorPhysical(po) || {});

module.exports = {
  joinVendorShipFromAddress,
  resolvePoVendorPhysical,
  joinPoVendorShipFrom,
};
