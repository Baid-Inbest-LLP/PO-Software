const mongoose = require('mongoose');

const DEPARTMENT_CATEGORIES = {
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

const DEPARTMENTS = Object.keys(DEPARTMENT_CATEGORIES);
const CATEGORIES = DEPARTMENTS.flatMap((department) => DEPARTMENT_CATEGORIES[department]);
const normalizeKey = (value) => String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

const LEGACY_DEPARTMENT_ALIASES = {
  'ADMIN & OFFICE': 'STATIONERY & OFFICE SUPPLIES',
  'EATABLES & PANTRY': 'PANTRY & KITCHEN',
  'IT & TECHNOLOGY': 'IT & ELECTRONICS',
  'ELECTRICAL & MAINTENANCE': 'ADMIN & FACILITY MANAGEMENT',
  'MARKETING & BRANDING': 'INBEST BRANDED ITEMS',
  'HR & PEOPLE': 'ADMIN & FACILITY MANAGEMENT',
};

const LEGACY_CATEGORY_ALIASES = {
  'PAPER & STATIONERY': 'Paper',
  'FILES & BINDERS': 'Files & Folders',
  'PENS & WRITING INSTRUMENTS': 'Writing Instruments',
  'OFFICE SUPPLIES': 'Desk Accessories & Office Tools',
  'CROCKERY & PANTRY WARE': 'Kitchenware & Utensils',
  'SOFTWARE LICENSES & SUBSCRIPTIONS': 'Software & Licenses',
  'IT ACCESSORIES & CONSUMABLES': 'Storage & Peripherals',
  'HOUSEKEEPING SUPPLIES': 'Cleaning Tools & Equipment',
};

const CANONICAL_DEPARTMENT_BY_KEY = DEPARTMENTS.reduce((acc, department) => {
  acc[normalizeKey(department)] = department;
  return acc;
}, {});

Object.entries(LEGACY_DEPARTMENT_ALIASES).forEach(([legacy, canonical]) => {
  CANONICAL_DEPARTMENT_BY_KEY[normalizeKey(legacy)] = canonical;
});

const CANONICAL_CATEGORY_BY_KEY = CATEGORIES.reduce((acc, category) => {
  acc[normalizeKey(category)] = category;
  return acc;
}, {});

Object.entries(LEGACY_CATEGORY_ALIASES).forEach(([legacy, canonical]) => {
  CANONICAL_CATEGORY_BY_KEY[normalizeKey(legacy)] = canonical;
});

const CATEGORY_TO_DEPARTMENT = Object.entries(DEPARTMENT_CATEGORIES).reduce((acc, [department, categories]) => {
  categories.forEach((category) => {
    acc[category] = department;
  });
  return acc;
}, {});

const itemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    unit: {
      type: String,
      default: 'pcs',
    },
    unitPrice: {
      type: Number,
      required: false,
      min: 0,
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      enum: {
        values: DEPARTMENTS,
        message: 'Invalid department: {VALUE}',
      },
      default: DEPARTMENTS[0],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: CATEGORIES,
        message: 'Invalid category: {VALUE}',
      },
      default: CATEGORIES[0],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

itemSchema.pre('validate', function normalizeDepartmentAndCategory(next) {
  if (this.name) {
    this.name = String(this.name).replace(/\s+/g, ' ').trim().toUpperCase();
  }

  if (this.department) {
    const canonicalDepartment = CANONICAL_DEPARTMENT_BY_KEY[normalizeKey(this.department)];
    if (canonicalDepartment) this.department = canonicalDepartment;
  }

  if (this.category) {
    const canonicalCategory = CANONICAL_CATEGORY_BY_KEY[normalizeKey(this.category)];
    if (canonicalCategory) this.category = canonicalCategory;
  }

  // Keep department/category internally consistent so legacy payloads still validate.
  if (this.category) {
    const expectedDepartment = CATEGORY_TO_DEPARTMENT[this.category];
    if (expectedDepartment) this.department = expectedDepartment;
  }

  next();
});

itemSchema.path('category').validate(function validateCategoryForDepartment(value) {
  const update = typeof this.getUpdate === 'function' ? this.getUpdate() : null;
  const department =
    this.department ||
    update?.department ||
    update?.$set?.department ||
    update?.$setOnInsert?.department;

  // If department is not in context, skip here; controller/save path enforces full validation.
  if (!department) return true;

  const categories = DEPARTMENT_CATEGORIES[department] || [];
  return categories.includes(value);
}, 'Selected category does not belong to the selected department');

itemSchema.index({ createdAt: -1 });
itemSchema.index({ isActive: 1, createdAt: -1 });
itemSchema.index({ department: 1, category: 1, createdAt: -1 });

module.exports = mongoose.model('Item', itemSchema);
