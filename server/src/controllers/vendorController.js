const Vendor = require('../models/Vendor');
const { normalizeVendor } = require('../utils/normalize');

const getVendors = async (req, res) => {
  const { search, isActive, page = 1, limit = 20 } = req.query;
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const filter = {};

  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { contactPerson: { $regex: search, $options: 'i' } },
    ];
  }

  const total = await Vendor.countDocuments(filter);
  const vendors = await Vendor.find(filter)
    .sort({ createdAt: -1 })
    .skip((parsedPage - 1) * parsedLimit)
    .limit(parsedLimit)
    .lean();

  res.json({ vendors, total, page: parsedPage, pages: Math.ceil(total / parsedLimit) });
};

const getVendor = async (req, res) => {
  const vendor = await Vendor.findOne({ _id: req.params.id }).lean();
  if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
  res.json(vendor);
};

const createVendor = async (req, res) => {
  try {
    const vendor = await Vendor.create({ ...normalizeVendor(req.body), createdBy: req.user._id });
    res.status(201).json(vendor);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: error.message });
  }
};

const updateVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findOneAndUpdate(
      { _id: req.params.id },
      normalizeVendor(req.body),
      { new: true, runValidators: true }
    );
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
    res.json(vendor);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: error.message });
  }
};

const deleteVendor = async (req, res) => {
  const vendor = await Vendor.findOneAndDelete({ _id: req.params.id });
  if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
  res.json({ message: 'Vendor deleted successfully' });
};

module.exports = { getVendors, getVendor, createVendor, updateVendor, deleteVendor };
