const collapseSpaces = (s) => String(s || '').replace(/\s+/g, ' ').trim();

const toUpper = (s) => collapseSpaces(s).toUpperCase();
const toLower = (s) => collapseSpaces(s).toLowerCase();

// "Pascal casing" for text fields (Title Case words)
const toPascal = (s) => {
  const str = collapseSpaces(s);
  if (!str) return '';
  return str
    .split(/[\s]+/)
    .map((w) => {
      const word = w.trim();
      if (!word) return '';
      const lower = word.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .filter(Boolean)
    .join(' ');
};

const normalizeCompany = (payload = {}) => ({
  ...payload,
  name: payload.name !== undefined ? toPascal(payload.name) : payload.name,
  companyCode: payload.companyCode !== undefined ? toUpper(payload.companyCode) : payload.companyCode,
  email: payload.email !== undefined ? toLower(payload.email) : payload.email,
  taxId: payload.taxId !== undefined ? toUpper(payload.taxId) : payload.taxId,
  locations: Array.isArray(payload.locations)
    ? payload.locations.map((l) => ({
      ...l,
      // Location name must be stored in uppercase consistently.
      label: l?.label !== undefined ? toUpper(l.label) : l?.label,
      street: l?.street !== undefined ? toPascal(l.street) : l?.street,
      city: l?.city !== undefined ? toPascal(l.city) : l?.city,
      state: l?.state !== undefined ? toPascal(l.state) : l?.state,
      zipCode: l?.zipCode !== undefined ? collapseSpaces(l.zipCode) : l?.zipCode,
      country: l?.country !== undefined ? toPascal(l.country) : l?.country,
    }))
    : payload.locations,
});

const normalizeVendor = (payload = {}) => {
  const { address, ...rest } = payload;
  let locations = payload.locations;
  if (!Array.isArray(locations) || locations.length === 0) {
    if (address && address.street && address.city && address.state && address.zipCode && address.country) {
      locations = [
        {
          label: 'LOCATION',
          street: address.street,
          city: address.city,
          state: address.state,
          zipCode: address.zipCode,
          country: address.country,
          isDefault: true,
        },
      ];
    }
  }
  const normalizedLocations = Array.isArray(locations)
    ? locations.map((l) => ({
      ...l,
      label: l?.label !== undefined ? toUpper(l.label) : l?.label,
      street: l?.street !== undefined ? toPascal(l.street) : l?.street,
      city: l?.city !== undefined ? toPascal(l.city) : l?.city,
      state: l?.state !== undefined ? toPascal(l.state) : l?.state,
      zipCode: l?.zipCode !== undefined ? collapseSpaces(l.zipCode) : l?.zipCode,
      country: l?.country !== undefined ? toPascal(l.country) : l?.country,
    }))
    : locations;

  return {
    ...rest,
    name: payload.name !== undefined ? toPascal(payload.name) : payload.name,
    contactPerson: payload.contactPerson !== undefined ? toPascal(payload.contactPerson) : payload.contactPerson,
    taxId: payload.taxId !== undefined ? toUpper(payload.taxId) : payload.taxId,
    locations: normalizedLocations,
    notes: payload.notes !== undefined ? toPascal(payload.notes) : payload.notes,
  };
};

const normalizeItem = (payload = {}) => ({
  ...payload,
  name: payload.name !== undefined ? toUpper(payload.name) : payload.name,
  description: payload.description !== undefined ? toPascal(payload.description) : payload.description,
  department: payload.department !== undefined ? collapseSpaces(payload.department) : payload.department,
  category: payload.category !== undefined ? collapseSpaces(payload.category) : payload.category,
});

const normalizePurchaseOrder = (payload = {}) => ({
  ...payload,
  department: payload.department !== undefined ? collapseSpaces(payload.department) : payload.department,
  notes: payload.notes !== undefined ? toPascal(payload.notes) : payload.notes,
  terms: payload.terms !== undefined ? toPascal(payload.terms) : payload.terms,
  vendorAddress: payload.vendorAddress
    ? {
      ...payload.vendorAddress,
      label: payload.vendorAddress.label !== undefined ? toUpper(payload.vendorAddress.label) : payload.vendorAddress.label,
      street: payload.vendorAddress.street !== undefined ? toPascal(payload.vendorAddress.street) : payload.vendorAddress.street,
      city: payload.vendorAddress.city !== undefined ? toPascal(payload.vendorAddress.city) : payload.vendorAddress.city,
      state: payload.vendorAddress.state !== undefined ? toPascal(payload.vendorAddress.state) : payload.vendorAddress.state,
      zipCode: payload.vendorAddress.zipCode !== undefined ? collapseSpaces(payload.vendorAddress.zipCode) : payload.vendorAddress.zipCode,
      country: payload.vendorAddress.country !== undefined ? toPascal(payload.vendorAddress.country) : payload.vendorAddress.country,
    }
    : payload.vendorAddress,
  shippingAddress: payload.shippingAddress
    ? {
      ...payload.shippingAddress,
      // Shipping location label is the same "Location Name" field and must be uppercase.
      label: payload.shippingAddress.label !== undefined ? toUpper(payload.shippingAddress.label) : payload.shippingAddress.label,
      company: payload.shippingAddress.company !== undefined ? toPascal(payload.shippingAddress.company) : payload.shippingAddress.company,
      street: payload.shippingAddress.street !== undefined ? toPascal(payload.shippingAddress.street) : payload.shippingAddress.street,
      city: payload.shippingAddress.city !== undefined ? toPascal(payload.shippingAddress.city) : payload.shippingAddress.city,
      state: payload.shippingAddress.state !== undefined ? toPascal(payload.shippingAddress.state) : payload.shippingAddress.state,
      zipCode: payload.shippingAddress.zipCode !== undefined ? collapseSpaces(payload.shippingAddress.zipCode) : payload.shippingAddress.zipCode,
      country: payload.shippingAddress.country !== undefined ? toPascal(payload.shippingAddress.country) : payload.shippingAddress.country,
    }
    : payload.shippingAddress,
  lineItems: Array.isArray(payload.lineItems)
    ? payload.lineItems.map((li) => ({
      ...li,
      description: li?.description !== undefined ? toPascal(li.description) : li?.description,
      unit: li?.unit !== undefined ? collapseSpaces(li.unit).toLowerCase() : li?.unit,
    }))
    : payload.lineItems,
});

module.exports = {
  collapseSpaces,
  toUpper,
  toLower,
  toPascal,
  normalizeCompany,
  normalizeVendor,
  normalizeItem,
  normalizePurchaseOrder,
};

