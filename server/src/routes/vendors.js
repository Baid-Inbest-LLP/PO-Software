const express = require('express');
const {
  getVendors,
  getVendor,
  createVendor,
  updateVendor,
  deleteVendor,
} = require('../controllers/vendorController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/').get(getVendors).post(createVendor);
router.route('/:id').get(getVendor).put(updateVendor).delete(authorize('PO_ADMIN', 'SUPERADMIN'), deleteVendor);

module.exports = router;
