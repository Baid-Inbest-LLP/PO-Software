const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema(
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

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
    },
    companyCode: {
      type: String,
      required: [true, 'Company code is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      validate: {
        validator: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        message: 'Enter a valid email address',
      },
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
    logo: { type: String, default: '' },
    /** Company stamp PNG (base64), uploaded in company settings — not used on PO exports yet. */
    stampImage: {
      type: String,
      default: '',
      select: false,
    },
    locations: {
      type: [locationSchema],
      validate: {
        validator: (v) => v.length >= 1,
        message: 'At least one location is required',
      },
    },
    isActive: { type: Boolean, default: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Ensure only one default location per company
companySchema.pre('save', function (next) {
  const defaults = this.locations.filter((l) => l.isDefault);
  if (defaults.length === 0 && this.locations.length > 0) {
    this.locations[0].isDefault = true;
  } else if (defaults.length > 1) {
    this.locations.forEach((l, i) => {
      l.isDefault = i === 0;
    });
  }
  next();
});

companySchema.index({ createdAt: -1 });
companySchema.index({ isActive: 1, createdAt: -1 });
companySchema.index({ name: 1 });
companySchema.index({ email: 1 });

module.exports = mongoose.model('Company', companySchema);
