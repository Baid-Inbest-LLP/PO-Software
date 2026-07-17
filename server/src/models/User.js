const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ['SUPERADMIN', 'PO_ADMIN', 'PO_Assistant'],
      default: 'PO_Assistant',
    },
    /** PNG signature (base64) for PO PDF/Excel — PO Admin only, set via upload in Settings. */
    signatureImage: {
      type: String,
      default: '',
      select: false,
    },
    /** Profile photo (base64) shown in the sidebar. */
    avatarImage: {
      type: String,
      default: '',
      select: false,
    },
    company: {
      name: { type: String, default: '' },
      address: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      zipCode: { type: String, default: '' },
      country: { type: String, default: '' },
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
      logo: { type: String, default: '' },
      taxId: { type: String, default: '' },
      website: { type: String, default: '' },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
