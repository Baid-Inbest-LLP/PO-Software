const mongoose = require('mongoose');

const vendorLocationSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: [true, 'Location name is required'],
      trim: true,
    },
    street: {
      type: String,
      required: [true, 'Street address is required'],
      trim: true,
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
    },
    zipCode: {
      type: String,
      required: [true, 'ZIP code is required'],
      trim: true,
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      trim: true,
    },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
);

const vendorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Vendor name is required'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      validate: {
        validator: (v) => /^(\+91|91)?[6-9]\d{9}$/.test(v.replace(/\s/g, '')),
        message: 'Enter a valid Indian phone number (e.g. 9876543210 or +919876543210)',
      },
    },
    contactPerson: {
      type: String,
      required: [true, 'Contact person is required'],
      trim: true,
    },
    /** @deprecated Prefer `locations`. Kept for legacy DB rows; migrated into `locations` on validate. */
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      zipCode: { type: String, trim: true },
      country: { type: String, trim: true },
    },
    locations: {
      type: [vendorLocationSchema],
      validate: {
        validator(arr) {
          return Array.isArray(arr) && arr.length >= 1;
        },
        message: 'At least one address location is required',
      },
    },
    taxId: {
      type: String,
      required: [true, 'GST No is required'],
      trim: true,
      uppercase: true,
      validate: {
        validator: (v) => /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v.toUpperCase()),
        message: 'Enter a valid GST number (e.g. 27AAPFU0939F1ZV)',
      },
    },
    bankDetails: {
      bankName: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      routingNumber: { type: String, default: '' },
    },
    notes: {
      type: String,
      default: '',
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

vendorSchema.pre('validate', function migrateLegacyAddress(next) {
  if (this.locations && this.locations.length > 0) {
    return next();
  }
  const a = this.address;
  if (a && a.street && a.city && a.state && a.zipCode && a.country) {
    this.locations = [
      {
        label: 'LOCATION',
        street: a.street,
        city: a.city,
        state: a.state,
        zipCode: a.zipCode,
        country: a.country,
        isDefault: true,
      },
    ];
  }
  return next();
});

vendorSchema.index({ createdAt: -1 });
vendorSchema.index({ isActive: 1, createdAt: -1 });
vendorSchema.index({ name: 1 });
vendorSchema.index({ contactPerson: 1 });

module.exports = mongoose.model('Vendor', vendorSchema);
