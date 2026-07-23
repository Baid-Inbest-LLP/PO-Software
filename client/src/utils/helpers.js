export const formatCurrency = (amount) => {
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
  return `₹${formatted}`;
};

export const formatInLac = (amount) => {
  const value = Number(amount) || 0;
  return `${(value / 100000).toFixed(2)} lac`;
};

export const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatDateInput = (date) => {
  if (!date) return '';
  return new Date(date).toISOString().split('T')[0];
};

export const STATUS_LABELS = {
  draft:     'Draft',
  pending:   'Pending',
  // First-level approval by PO Admin should read as "Completed" for users.
  approved_by_admin: 'Completed',
  rejected:  'Rejected',
  // Final approval by Superadmin should read as "Approved".
  completed: 'Approved',
  cancelled: 'Cancelled',
};

export const STATUS_COLORS = {
  draft:     'badge-draft',
  pending:   'badge-pending',
  approved_by_admin: 'badge-approved',
  rejected:  'badge-rejected',
  completed: 'badge-completed',
  cancelled: 'badge-cancelled',
};

export const UNITS = ['pcs', 'pkt', 'kg', 'g', 'lb', 'oz', 'box', 'carton', 'set', 'pair', 'm', 'cm', 'ft', 'in', 'L', 'ml', 'hr', 'day'];

export const DEPARTMENT_CATEGORIES = {
  'STATIONERY & OFFICE SUPPLIES': [
    'Paper',
    'Files & Folders',
    'Writing Instruments',
    'Desk Accessories & Office Tools',
    'Registers & Record Books',
    'Printer Consumables',
  ],
  'INBEST BRANDED ITEMS': [
    'Printed & Promotional Stationery',
  ],
  'IT & ELECTRONICS': [
    'Mobile & Tablets',
    'Computers & Accessories',
    'Software & Licenses',
    'Storage & Peripherals',
  ],
  'ADMIN & FACILITY MANAGEMENT': [
    'Electrical & Miscellaneous',
    'Furniture & Equipment',
  ],
  'HOUSEKEEPING & HYGIENE': [
    'Personal Care & Hygiene Products',
    'Cleaning Products & Chemicals',
    'Cleaning Tools & Equipment',
  ],
  'PANTRY & KITCHEN': [
    'Beverages & Tea/Coffee',
    'Snacks & Biscuits',
    'Condiments & Food Items',
    'Kitchenware & Utensils',
  ],
  OTHER: [
    'General Supplies',
    'Services & Professional Fees',
    'Travel & Conveyance',
    'Packaging & Shipping',
    'Safety & Security',
    'Events & Hospitality',
    'Gifts & Miscellaneous',
    'Other',
  ],
};

const DEPARTMENT_COLORS = [
  'bg-slate-100 text-slate-700 border-slate-200',
  'bg-emerald-100 text-emerald-700 border-emerald-200',
  'bg-sky-100 text-sky-700 border-sky-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-rose-100 text-rose-700 border-rose-200',
  'bg-violet-100 text-violet-700 border-violet-200',
  'bg-cyan-100 text-cyan-700 border-cyan-200',
  'bg-orange-100 text-orange-700 border-orange-200',
  'bg-teal-100 text-teal-700 border-teal-200',
];

const CATEGORY_COLORS = [
  'bg-indigo-100 text-indigo-700 border-indigo-200',
  'bg-lime-100 text-lime-700 border-lime-200',
  'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-green-100 text-green-700 border-green-200',
  'bg-pink-100 text-pink-700 border-pink-200',
];

export const ITEM_DEPARTMENTS = Object.keys(DEPARTMENT_CATEGORIES);
export const ITEM_CATEGORIES = ITEM_DEPARTMENTS.flatMap((department) =>
  DEPARTMENT_CATEGORIES[department].map((name) => ({ name, department }))
);
export const ITEM_CATEGORY_NAMES = ITEM_CATEGORIES.map((c) => c.name);
export const DEFAULT_DEPARTMENT = ITEM_DEPARTMENTS[0];
export const DEFAULT_CATEGORY = DEPARTMENT_CATEGORIES[DEFAULT_DEPARTMENT][0];

export const CATEGORY_COLOR_MAP = Object.fromEntries(
  ITEM_CATEGORY_NAMES.map((name, idx) => [name, CATEGORY_COLORS[idx % CATEGORY_COLORS.length]])
);

export const DEPARTMENT_COLOR_MAP = Object.fromEntries(
  ITEM_DEPARTMENTS.map((name, idx) => [name, DEPARTMENT_COLORS[idx % DEPARTMENT_COLORS.length]])
);

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'INR', 'CNY'];

export const PAYMENT_TERMS = [
  'Net 15',
  'Net 30',
  'Net 45',
  'Net 60',
  'Due on Receipt',
  'Advance Payment',
  '50% Advance',
];

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const belowThousand = (n) => {
  if (n === 0) return '';
  if (n < 20) return ONES[n] + ' ';
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '') + ' ';
  return ONES[Math.floor(n / 100)] + ' Hundred ' + belowThousand(n % 100);
};

export const amountToWords = (amount) => {
  if (!amount || amount === 0) return 'Zero Rupees Only';
  let n = Math.abs(Math.round(amount * 100)) ; // work in paise
  const paise = n % 100;
  const rupees = Math.floor(n / 100);

  const parts = [];
  let r = rupees;
  if (r >= 10000000) { parts.push(belowThousand(Math.floor(r / 10000000)) + 'Crore'); r %= 10000000; }
  if (r >= 100000)   { parts.push(belowThousand(Math.floor(r / 100000))   + 'Lakh');  r %= 100000;   }
  if (r >= 1000)     { parts.push(belowThousand(Math.floor(r / 1000))     + 'Thousand'); r %= 1000;   }
  if (r > 0)         { parts.push(belowThousand(r)); }

  let result = 'Rupees ' + parts.join(' ').replace(/\s+/g, ' ').trim();
  if (paise > 0) result += ' and ' + belowThousand(paise).trim() + ' Paise';
  return result + ' Only';
};

/** Vendor locations for UI; legacy single `address` becomes one synthetic row with id `legacy`. */
export const vendorLocationsList = (vendor) => {
  if (!vendor) return [];
  if (Array.isArray(vendor.locations) && vendor.locations.length > 0) return vendor.locations;
  const a = vendor.address;
  if (a && (String(a.street || '').trim() || String(a.city || '').trim())) {
    return [
      {
        _id: 'legacy',
        label: 'LOCATION',
        street: a.street || '',
        city: a.city || '',
        state: a.state || '',
        zipCode: a.zipCode || '',
        country: a.country || '',
        isDefault: true,
      },
    ];
  }
  return [];
};

/** Physical vendor address to show on PO detail (snapshot → legacy address → location match). */
export const orderVendorPhysicalForDisplay = (order) => {
  if (!order) return null;
  const snap = order.vendorAddress;
  if (snap && (String(snap.street || '').trim() || String(snap.city || '').trim())) {
    return snap;
  }
  const v = order.vendor;
  if (v?.address && (String(v.address.street || '').trim() || String(v.address.city || '').trim())) {
    return v.address;
  }
  const locs = vendorLocationsList(v);
  if (!locs.length) return null;
  const id = order.vendorLocationId;
  if (id) {
    const hit = locs.find((l) => String(l._id) === String(id));
    if (hit) return hit;
  }
  return locs.find((l) => l.isDefault) || locs[0];
};

export const downloadBlob = (blob, filename) => {
  const safeFilename = String(filename || 'download')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeFilename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
