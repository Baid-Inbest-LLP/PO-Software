const Item = require('../models/Item');
const { normalizeItem } = require('../utils/normalize');

const getItems = async (req, res) => {
  const { search, department, category, isActive, page = 1, limit = 20 } = req.query;
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 500);
  const filter = {};

  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (department) filter.department = department;
  if (category) filter.category = category;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  const total = await Item.countDocuments(filter);
  const items = await Item.find(filter)
    .sort({ category: 1, name: 1 })
    .skip((parsedPage - 1) * parsedLimit)
    .limit(parsedLimit)
    .lean();

  res.json({ items, total, page: parsedPage, pages: Math.ceil(total / parsedLimit) });
};

const getItem = async (req, res) => {
  const item = await Item.findOne({ _id: req.params.id }).lean();
  if (!item) return res.status(404).json({ message: 'Item not found' });
  res.json(item);
};

const createItem = async (req, res) => {
  const item = await Item.create({ ...normalizeItem(req.body), createdBy: req.user._id });
  res.status(201).json(item);
};

const updateItem = async (req, res) => {
  const item = await Item.findOne({ _id: req.params.id });
  if (!item) return res.status(404).json({ message: 'Item not found' });

  Object.assign(item, normalizeItem(req.body));
  await item.save();
  res.json(item);
};

const deleteItem = async (req, res) => {
  const item = await Item.findOneAndDelete({ _id: req.params.id });
  if (!item) return res.status(404).json({ message: 'Item not found' });
  res.json({ message: 'Item deleted successfully' });
};

const getCategories = async (req, res) => {
  const categories = await Item.distinct('category', {});
  res.json(categories);
};

module.exports = { getItems, getItem, createItem, updateItem, deleteItem, getCategories };
