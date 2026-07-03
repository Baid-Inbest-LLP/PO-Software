const express = require('express');
const {
  getItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  getCategories,
} = require('../controllers/itemController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/categories', getCategories);
router.route('/').get(getItems).post(createItem);
router.route('/:id').get(getItem).put(updateItem).delete(authorize('PO_ADMIN', 'SUPERADMIN'), deleteItem);

module.exports = router;
