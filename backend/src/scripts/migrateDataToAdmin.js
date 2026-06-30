/* eslint-disable no-console */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Company = require('../models/Company');
const Vendor = require('../models/Vendor');
const Item = require('../models/Item');
const PurchaseOrder = require('../models/PurchaseOrder');

const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'superadmin@inbestnow.com';
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || 'Superadmin@123';
const SUPERADMIN_NAME = process.env.SUPERADMIN_NAME || 'System Superadmin';

async function getOrCreateSuperadmin() {
  let superadmin = await User.findOne({ email: SUPERADMIN_EMAIL });
  if (!superadmin) {
    superadmin = await User.create({
      name: SUPERADMIN_NAME,
      email: SUPERADMIN_EMAIL,
      password: SUPERADMIN_PASSWORD,
      role: 'SUPERADMIN',
      isActive: true,
    });
    console.log(`Created SUPERADMIN user: ${SUPERADMIN_EMAIL}`);
  }
  return superadmin;
}

async function migrateCollection(Model, label, adminId) {
  const before = await Model.countDocuments({ createdBy: { $ne: adminId } });
  const result = await Model.updateMany(
    { createdBy: { $ne: adminId } },
    { $set: { createdBy: adminId } }
  );
  const after = await Model.countDocuments({ createdBy: { $ne: adminId } });

  console.log(
    `${label}: migrated ${result.modifiedCount} document(s) ` +
      `(remaining non-admin: ${after}, before: ${before})`
  );
}

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('Missing MONGODB_URI in backend/.env');
    process.exit(1);
  }

  await connectDB();
  const admin = await getOrCreateSuperadmin();

  console.log(`Migrating all ownership to SUPERADMIN: ${admin.email} (${admin._id})`);

  await migrateCollection(Company, 'Companies', admin._id);
  await migrateCollection(Vendor, 'Vendors', admin._id);
  await migrateCollection(Item, 'Items', admin._id);
  await migrateCollection(PurchaseOrder, 'Purchase Orders', admin._id);

  const summary = await Promise.all([
    Company.countDocuments({ createdBy: admin._id }),
    Vendor.countDocuments({ createdBy: admin._id }),
    Item.countDocuments({ createdBy: admin._id }),
    PurchaseOrder.countDocuments({ createdBy: admin._id }),
  ]);

  console.log(
    `Done. SUPERADMIN-owned totals => Companies: ${summary[0]}, Vendors: ${summary[1]}, ` +
      `Items: ${summary[2]}, Purchase Orders: ${summary[3]}`
  );

  await mongoose.connection.close();
}

run().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.connection.close();
  } catch {}
  process.exit(1);
});

