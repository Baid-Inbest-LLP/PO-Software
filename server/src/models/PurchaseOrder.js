const mongoose = require('mongoose');

const lineItemSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      default: null,
    },
    description: {
      type: String,
      required: [true, 'Item description is required'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0, 'Quantity cannot be negative'],
    },
    unit: {
      type: String,
      default: 'pcs',
    },
    unitPrice: {
      type: Number,
      required: [true, 'Unit price is required'],
      min: [0, 'Unit price cannot be negative'],
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    gstRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    gstAmount: {
      type: Number,
      default: 0,
    },
    totalPrice: {
      type: Number,
      default: 0,
    },
  },
  { _id: true }
);

const purchaseOrderSchema = new mongoose.Schema(
  {
    poNumber: {
      type: String,
      unique: true,
      required: true,
    },
    // Workflow:
    // pending -> approved_by_admin -> completed
    // rejected is possible from pending/approved_by_admin
    // Legacy only: draft -> pending | rejected
    status: {
      type: String,
      enum: ['draft', 'pending', 'approved_by_admin', 'rejected', 'completed', 'cancelled'],
      default: 'pending',
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company is required'],
    },
    department: {
      type: String,
      default: '',
      trim: true,
    },
    shippingLocationId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: [true, 'Vendor is required'],
    },
    vendorLocationId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    /** Snapshot of vendor ship-from address at PO time */
    vendorAddress: {
      label: { type: String, default: '' },
      street: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      zipCode: { type: String, default: '' },
      country: { type: String, default: '' },
    },
    shippingAddress: {
      label:   { type: String, default: '' },
      company: { type: String, default: '' },
      street:  { type: String, default: '' },
      city:    { type: String, default: '' },
      state:   { type: String, default: '' },
      zipCode: { type: String, default: '' },
      country: { type: String, default: '' },
    },
    orderDate: {
      type: Date,
      default: Date.now,
    },
    expectedDeliveryDate: {
      type: Date,
      default: null,
    },
    lineItems: [lineItemSchema],
    subtotal: {
      type: Number,
      default: 0,
    },
    shippingCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      default: '',
    },
    terms: {
      type: String,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    approvedByAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedByAdminAt: {
      type: Date,
      default: null,
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: '',
      maxlength: 2000,
    },
  },
  { timestamps: true }
);

purchaseOrderSchema.pre('save', function (next) {
  const { applyLineItemAmounts, summarizePoAmounts } = require('../utils/poAmounts');

  this.lineItems.forEach((item) => {
    const { gstAmount, totalPrice } = applyLineItemAmounts(item);
    item.gstAmount = gstAmount;
    item.totalPrice = totalPrice;
  });

  const summary = summarizePoAmounts(this.lineItems, this.shippingCost || 0);
  // Keep subtotal as sum of rounded line totals for backward-compatible field usage.
  this.subtotal = summary.itemsTotal;
  this.totalAmount = summary.grandTotal;

  if (this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }

  next();
});

// Common list/dashboard query patterns
purchaseOrderSchema.index({ createdAt: -1 });
purchaseOrderSchema.index({ status: 1, createdAt: -1 });
purchaseOrderSchema.index({ vendor: 1, createdAt: -1 });
purchaseOrderSchema.index({ company: 1, createdAt: -1 });
purchaseOrderSchema.index({ status: 1, orderDate: 1 });
purchaseOrderSchema.index({ orderDate: 1 });

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);
