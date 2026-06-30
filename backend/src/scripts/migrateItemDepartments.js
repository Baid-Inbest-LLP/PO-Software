/* eslint-disable no-console */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Item = require('../models/Item');

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
};

const CATEGORY_TO_DEPARTMENT = Object.entries(DEPARTMENT_CATEGORIES).reduce((acc, [department, categories]) => {
  categories.forEach((category) => {
    acc[category] = department;
  });
  return acc;
}, {});

const LEGACY_CATEGORY_REMAP = {
  'Raw Materials': { department: 'STATIONERY & OFFICE SUPPLIES', category: 'Paper' },
  'Electronics & Components': { department: 'IT & ELECTRONICS', category: 'Computers & Accessories' },
  'Machinery & Equipment': { department: 'ADMIN & FACILITY MANAGEMENT', category: 'Electrical & Miscellaneous' },
  'Office Supplies': { department: 'STATIONERY & OFFICE SUPPLIES', category: 'Desk Accessories & Office Tools' },
  'IT & Software': { department: 'IT & ELECTRONICS', category: 'Software & Licenses' },
  'Packaging Materials': { department: 'PANTRY & KITCHEN', category: 'Kitchenware & Utensils' },
  Consumables: { department: 'HOUSEKEEPING & HYGIENE', category: 'Cleaning Products & Chemicals' },
  'Spare Parts': { department: 'IT & ELECTRONICS', category: 'Storage & Peripherals' },
  Services: { department: 'ADMIN & FACILITY MANAGEMENT', category: 'Furniture & Equipment' },
  Others: { department: 'STATIONERY & OFFICE SUPPLIES', category: 'Desk Accessories & Office Tools' },
};

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('Missing MONGODB_URI in backend/.env');
    process.exit(1);
  }

  await connectDB();

  const items = await Item.find({}, '_id name category department');
  let updated = 0;
  let alreadyValid = 0;
  let remappedLegacy = 0;
  let defaultedUnknown = 0;

  for (const item of items) {
    const expectedDepartment = CATEGORY_TO_DEPARTMENT[item.category];
    if (!expectedDepartment) {
      const remap = LEGACY_CATEGORY_REMAP[item.category];
      if (remap) {
        item.department = remap.department;
        item.category = remap.category;
        await item.save();
        remappedLegacy += 1;
      } else {
        item.department = 'STATIONERY & OFFICE SUPPLIES';
        item.category = 'Desk Accessories & Office Tools';
        await item.save();
        defaultedUnknown += 1;
      }
      continue;
    }
    if (item.department === expectedDepartment) {
      alreadyValid += 1;
      continue;
    }

    item.department = expectedDepartment;
    await item.save();
    updated += 1;
  }

  console.log(`Items scanned: ${items.length}`);
  console.log(`Updated department: ${updated}`);
  console.log(`Already valid: ${alreadyValid}`);
  console.log(`Remapped legacy categories: ${remappedLegacy}`);
  console.log(`Defaulted unknown categories: ${defaultedUnknown}`);

  await mongoose.connection.close();
}

run().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.connection.close();
  } catch {}
  process.exit(1);
});

