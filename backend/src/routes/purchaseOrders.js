const express = require('express');
const {
  getPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  updatePurchaseOrder,
  updateStatus,
  deletePurchaseOrder,
  downloadPDF,
  downloadExcel,
  getDashboardStats,
} = require('../controllers/purchaseOrderController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/dashboard', getDashboardStats);
router.route('/').get(getPurchaseOrders).post(createPurchaseOrder);
router.route('/:id').get(getPurchaseOrder).put(updatePurchaseOrder).delete(deletePurchaseOrder);
router.patch('/:id/status', authorize('PO_ADMIN', 'SUPERADMIN'), updateStatus);
router.get('/:id/download/pdf', downloadPDF);
router.get('/:id/download/excel', downloadExcel);

module.exports = router;
