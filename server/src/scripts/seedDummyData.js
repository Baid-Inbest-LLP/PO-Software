/* eslint-disable no-console */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Item = require('../models/Item');
const ITEM_CATALOG_SEED_DATA = require('./itemCatalogSeedData');

async function getOrCreateSeedUsers() {
  const adminEmail = process.env.SEED_SUPERADMIN_EMAIL || 'superadmin@inbestnow.com';
  const adminPassword = process.env.SEED_SUPERADMIN_PASSWORD || 'Superadmin@123';
  const poAdminEmail = process.env.SEED_PO_ADMIN_EMAIL || 'admin@inbestnow.com';
  const poAdminPassword = process.env.SEED_PO_ADMIN_PASSWORD || 'Admin@123';
  const assistantEmail = process.env.SEED_EMAIL || 'demo.assistant@po.local';
  const assistantPassword = process.env.SEED_PASSWORD || 'Demo@12345';

  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    admin = await User.create({
      name: 'System Superadmin',
      email: adminEmail,
      password: adminPassword,
      role: 'SUPERADMIN',
      isActive: true,
    });
  }

  let poAdmin = await User.findOne({ email: poAdminEmail });
  if (!poAdmin) {
    poAdmin = await User.create({
      name: 'System PO Admin',
      email: poAdminEmail,
      password: poAdminPassword,
      role: 'PO_ADMIN',
      isActive: true,
    });
  }

  let assistant = await User.findOne({ email: assistantEmail });
  if (!assistant) {
    assistant = await User.create({
      name: 'Demo PO Assistant',
      email: assistantEmail,
      password: assistantPassword,
      role: 'PO_Assistant',
      isActive: true,
    });
  }

  return {
    admin: { _id: admin._id, name: admin.name, email: admin.email },
    poAdmin: { _id: poAdmin._id, name: poAdmin.name, email: poAdmin.email },
    assistant: { _id: assistant._id, name: assistant.name, email: assistant.email },
  };
}

function buildItems(createdBy) {
  const items = [];
  ITEM_CATALOG_SEED_DATA.forEach((departmentEntry) => {
    departmentEntry.categories.forEach((categoryEntry) => {
      categoryEntry.items.forEach((itemEntry) => {
        const rawUnit = String(itemEntry.unit || '').trim().toLowerCase();
        const unit = rawUnit || 'pcs';

        items.push({
          name: itemEntry.item,
          unit,
          department: departmentEntry.department,
          category: categoryEntry.category,
          description: `${categoryEntry.category} - ${departmentEntry.department}`,
          isActive: true,
          createdBy,
        });
      });
    });
  });
  return items;
}

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('Missing MONGODB_URI in server/.env');
    process.exit(1);
  }

  await connectDB();

  const { admin, assistant } = await getOrCreateSeedUsers();
  console.log(`Admin user: ${admin.email} (${admin._id})`);
  console.log(`Seeding for assistant user: ${assistant.email} (${assistant._id})`);

  const items = buildItems(assistant._id);

  await Item.deleteMany({ createdBy: assistant._id });
  await Item.insertMany(items, { ordered: false });

  const itemCount = await Item.countDocuments({ createdBy: assistant._id });

  console.log(`Done. Items seeded: ${itemCount}.`);
  await mongoose.connection.close();
}

run().catch(async (err) => {
  console.error(err);
  try { await mongoose.connection.close(); } catch {}
  process.exit(1);
});

