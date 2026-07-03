const PurchaseOrder = require('../models/PurchaseOrder');
const { generatePONumber } = require('../utils/helpers');
const { normalizePurchaseOrder } = require('../utils/normalize');

const { toDataUri: assetToDataUri, getPoDocumentAssets, getPoDocumentAssetBuffers, getFontFaceCss } = require('../utils/assetLoader');

// In-memory PDF/Excel caches (fast repeat downloads). Kept bounded to avoid memory growth.
const PDF_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const PDF_CACHE_MAX_ENTRIES = 50;
const pdfCache = new Map(); // key -> { buffer, createdAt }
const EXCEL_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const EXCEL_CACHE_MAX_ENTRIES = 50;
const excelCache = new Map(); // key -> { buffer, createdAt }
const DASHBOARD_CACHE_TTL_MS = 60 * 1000; // 1 minute
const dashboardCache = new Map(); // key -> { data, createdAt }

const getPdfAssets = (po) => {
  const approverSignatureImage = po?.approvedByAdmin?.signatureImage || '';
  const docAssets = getPoDocumentAssets({ approverSignatureImage });
  const assets = {
    logoSrc: assetToDataUri('Inbest_Logo(Blue).png', 'image/png'),
    shreeSrc: assetToDataUri('shree_red.png', 'image/png'),
    adminSignatureSrc: docAssets.adminSignatureSrc,
    superadminSignatureSrc: docAssets.superadminSignatureSrc,
  };
  // No admin signature on file → left Admin & Accounts area stays blank (by design).
  if (po?.status === 'completed' && !assets.superadminSignatureSrc) {
    console.warn('[PO] WARNING: Md_SIGN.png not found (run npm run generate:embedded-assets)');
  }
  return assets;
};

const setDocDebugHeaders = (res, { renderVersion, assets, status, cacheKey, cached }) => {
  const adminLen = String(assets?.adminSignatureSrc || '').length;
  const superLen = String(assets?.superadminSignatureSrc || '').length;
  const logoLen = String(assets?.logoSrc || '').length;
  const shreeLen = String(assets?.shreeSrc || '').length;
  res.setHeader('X-PO-Render-Version', renderVersion);
  res.setHeader('X-PO-Order-Status', String(status || ''));
  res.setHeader('X-PO-Stamp-Lens', `${adminLen},${superLen}`);
  res.setHeader('X-PO-Logo-Lens', `${logoLen},${shreeLen}`);
  res.setHeader('X-PO-Doc-Cache', cached ? 'hit' : 'miss');
  res.setHeader('X-PO-Doc-Key', String(cacheKey || '').slice(-48));
};

function getCachedPdf(cacheKey) {
  const cached = pdfCache.get(cacheKey);
  if (!cached) return null;
  if (Date.now() - cached.createdAt > PDF_CACHE_TTL_MS) {
    pdfCache.delete(cacheKey);
    return null;
  }
  return cached.buffer;
}

function setCachedPdf(cacheKey, buffer) {
  // Simple eviction: remove oldest entry when hitting the limit.
  if (pdfCache.size >= PDF_CACHE_MAX_ENTRIES) {
    const oldestKey = pdfCache.keys().next().value;
    if (oldestKey) pdfCache.delete(oldestKey);
  }
  pdfCache.set(cacheKey, { buffer, createdAt: Date.now() });
}

function getCachedExcel(cacheKey) {
  const cached = excelCache.get(cacheKey);
  if (!cached) return null;
  if (Date.now() - cached.createdAt > EXCEL_CACHE_TTL_MS) {
    excelCache.delete(cacheKey);
    return null;
  }
  return cached.buffer;
}

function setCachedExcel(cacheKey, buffer) {
  if (excelCache.size >= EXCEL_CACHE_MAX_ENTRIES) {
    const oldestKey = excelCache.keys().next().value;
    if (oldestKey) excelCache.delete(oldestKey);
  }
  excelCache.set(cacheKey, { buffer, createdAt: Date.now() });
}

function getCachedDashboard(cacheKey) {
  const cached = dashboardCache.get(cacheKey);
  if (!cached) return null;
  if (Date.now() - cached.createdAt > DASHBOARD_CACHE_TTL_MS) {
    dashboardCache.delete(cacheKey);
    return null;
  }
  return cached.data;
}

function setCachedDashboard(cacheKey, data) {
  dashboardCache.set(cacheKey, { data, createdAt: Date.now() });
}

function clearDashboardCache() {
  dashboardCache.clear();
}

function clearDocumentCaches() {
  pdfCache.clear();
  excelCache.clear();
}

// Valid status transitions (status changes only via PATCH /status, not body updates)
const TRANSITIONS = {
  draft: ['pending', 'rejected'], // legacy records only
  pending: ['approved_by_admin', 'rejected'],
  approved_by_admin: ['completed'],
};
const normalizeRole = (role) => (role === 'ADMIN' ? 'PO_ADMIN' : role);

const getPurchaseOrders = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  const { search, status, vendor, page = 1, limit = 20, startDate, endDate } = req.query;
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const filter = {};

  if (status) filter.status = status;
  if (vendor) filter.vendor = vendor;
  if (search) {
    filter.$or = [{ poNumber: { $regex: search, $options: 'i' } }];
  }
  if (startDate || endDate) {
    filter.orderDate = {};
    if (startDate) filter.orderDate.$gte = new Date(startDate);
    if (endDate) filter.orderDate.$lte = new Date(endDate);
  }

  const total = await PurchaseOrder.countDocuments(filter);
  const orders = await PurchaseOrder.find(filter)
    .select('poNumber status company vendor totalAmount orderDate expectedDeliveryDate createdAt')
    .populate('vendor', 'name phone')
    .populate('company', 'name companyCode')
    .sort({ createdAt: -1 })
    .skip((parsedPage - 1) * parsedLimit)
    .limit(parsedLimit)
    .lean();

  res.json({ orders, total, page: parsedPage, pages: Math.ceil(total / parsedLimit) });
};

const getPurchaseOrder = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  const order = await PurchaseOrder.findOne({ _id: req.params.id })
    .populate('vendor')
    .populate('company')
    .populate('createdBy', 'name email')
    .populate('approvedByAdmin', 'name email')
    .populate('completedBy', 'name email')
    .populate('lineItems.item', 'name sku')
    .lean();

  if (!order) return res.status(404).json({ message: 'Purchase order not found' });
  res.json(order);
};

const createPurchaseOrder = async (req, res) => {
  const locationLabel = req.body.shippingAddress?.label || '';
  const poNumber = await generatePONumber(PurchaseOrder, locationLabel);
  const normalized = normalizePurchaseOrder(req.body);
  delete normalized.status;
  delete normalized.approvedByAdmin;
  delete normalized.approvedByAdminAt;
  delete normalized.completedBy;
  delete normalized.completedAt;
  const order = await PurchaseOrder.create({
    ...normalized,
    status: 'pending',
    poNumber,
    createdBy: req.user._id,
  });

  const populated = await PurchaseOrder.findById(order._id)
    .populate('vendor', 'name phone')
    .populate('company', 'name companyCode')
    .populate('createdBy', 'name email');

  clearDashboardCache();
  clearDocumentCaches();
  res.status(201).json(populated);
};

const updatePurchaseOrder = async (req, res) => {
  const order = await PurchaseOrder.findOne({ _id: req.params.id });
  if (!order) return res.status(404).json({ message: 'Purchase order not found' });

  if (!['draft', 'pending'].includes(order.status)) {
    return res.status(400).json({ message: `Cannot edit a ${order.status} purchase order` });
  }

  const normalized = normalizePurchaseOrder(req.body);
  delete normalized.status;
  delete normalized.rejectionReason;
  delete normalized.approvedByAdmin;
  delete normalized.approvedByAdminAt;
  delete normalized.completedBy;
  delete normalized.completedAt;
  Object.assign(order, normalized);
  await order.save();

  const populated = await PurchaseOrder.findById(order._id)
    .populate('vendor', 'name phone')
    .populate('company', 'name companyCode')
    .populate('createdBy', 'name email');

  clearDashboardCache();
  clearDocumentCaches();
  res.json(populated);
};

const updateStatus = async (req, res) => {
  const { status, rejectionReason } = req.body;
  const order = await PurchaseOrder.findOne({ _id: req.params.id });
  if (!order) return res.status(404).json({ message: 'Purchase order not found' });

  const allowed = TRANSITIONS[order.status] || [];
  if (!allowed.includes(status)) {
    return res.status(400).json({
      message: `Cannot move from "${order.status}" to "${status}"`,
    });
  }

  const actorRole = normalizeRole(req.user?.role);
  const isPoAdmin = actorRole === 'PO_ADMIN';
  const isSuperadmin = actorRole === 'SUPERADMIN';

  if (order.status === 'pending' && status === 'approved_by_admin' && !isPoAdmin) {
    return res.status(403).json({ message: 'Only PO Admin can perform first-level approval' });
  }

  if (order.status === 'approved_by_admin' && status === 'completed' && !isSuperadmin) {
    return res.status(403).json({ message: 'Only Superadmin can perform final approval' });
  }

  if (status === 'rejected') {
    const canRejectPending = order.status === 'pending' && isPoAdmin;
    const canRejectLegacyDraft = order.status === 'draft' && isPoAdmin;
    if (!canRejectPending && !canRejectLegacyDraft) {
      return res.status(403).json({ message: 'You are not allowed to reject this purchase order at its current stage' });
    }
  }

  if (status === 'rejected') {
    const reason = typeof rejectionReason === 'string' ? rejectionReason.trim() : '';
    if (!reason) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }
    order.rejectionReason = reason.slice(0, 2000);
  } else {
    order.rejectionReason = '';
  }

  if (status === 'approved_by_admin') {
    order.approvedByAdmin = req.user._id;
    order.approvedByAdminAt = new Date();
  }

  if (status === 'completed') {
    order.completedBy = req.user._id;
    order.completedAt = new Date();
  }

  order.status = status;
  await order.save();

  const populated = await PurchaseOrder.findById(order._id)
    .populate('vendor')
    .populate('company')
    .populate('createdBy', 'name email')
    .populate('approvedByAdmin', 'name email')
    .populate('completedBy', 'name email')
    .populate('lineItems.item', 'name sku');

  clearDashboardCache();
  clearDocumentCaches();
  res.json(populated);
};

const deletePurchaseOrder = async (req, res) => {
  const order = await PurchaseOrder.findOne({ _id: req.params.id });
  if (!order) return res.status(404).json({ message: 'Purchase order not found' });

  if (!['draft', 'pending'].includes(order.status)) {
    return res.status(400).json({ message: 'Only pending (or legacy draft) purchase orders can be deleted' });
  }

  await order.deleteOne();
  clearDashboardCache();
  clearDocumentCaches();
  res.json({ message: 'Purchase order deleted successfully' });
};

const downloadPDF = async (req, res) => {
  try {
    // Lazy-require heavy modules to reduce cold-start and non-PDF route latency.
    const { poPdfHtml, poPdfHeaderFooterTemplates } = require('../utils/poPdfTemplate');
    const { renderHtmlToPdfBuffer } = require('../utils/puppeteerPdf');
    const { amountToWordsINR } = require('../utils/amountToWords');

    const order = await PurchaseOrder.findOne({ _id: req.params.id })
      .select(
        'poNumber status company vendor createdBy approvedByAdmin lineItems shippingAddress vendorAddress '
        + 'department orderDate expectedDeliveryDate totalAmount shippingCost notes terms createdAt updatedAt'
      )
      .populate('vendor', 'name phone taxId')
      .populate('company', 'companyCode phone taxId locations')
      .populate('createdBy', 'name email')
      .populate('approvedByAdmin', 'name email +signatureImage')
      .populate('lineItems.item', 'name sku category unit department')
      .lean();

    if (!order) return res.status(404).json({ message: 'Purchase order not found' });

    if (!['approved_by_admin', 'completed'].includes(order.status)) {
      return res.status(400).json({ message: 'PDF download is only available when the PO is Approved or completed' });
    }

    const poObj = order;
    const assets = getPdfAssets(poObj);

    const safeName = String(order.poNumber || 'purchase-order').replace(/[\\/:*?"<>|]+/g, '-');
    const approverId = order.approvedByAdmin?._id || 'none';
    const cacheKey = `${order._id}:${order.status}:v32:${approverId}:${order.updatedAt?.getTime?.() || order.createdAt?.getTime?.() || 0}`;
    const cachedBuffer = getCachedPdf(cacheKey);
    if (cachedBuffer) {
      setDocDebugHeaders(res, {
        renderVersion: 'v32',
        assets,
        status: order.status,
        cacheKey,
        cached: true,
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);
      res.setHeader('Content-Length', String(cachedBuffer.length));
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return res.send(cachedBuffer);
    }

    setDocDebugHeaders(res, {
      renderVersion: 'v32',
      assets,
      status: order.status,
      cacheKey,
      cached: false,
    });
    console.log('[PO] PDF signature debug', {
      status: order.status,
      cacheKey,
      adminLen: String(assets.adminSignatureSrc || '').length,
      superLen: String(assets.superadminSignatureSrc || '').length,
      logoLen: String(assets.logoSrc || '').length,
      shreeLen: String(assets.shreeSrc || '').length,
    });
    const fontCss = getFontFaceCss();
    const html = poPdfHtml({
      po: poObj,
      amountInWords: amountToWordsINR(Math.round(poObj.totalAmount || 0)),
      assets,
      fontCss,
    });

    const { headerHtml, footerHtml } = poPdfHeaderFooterTemplates({ po: poObj, assets, fontCss });
    const raw = await renderHtmlToPdfBuffer(html, { headerHtml, footerHtml });
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw || []);

    // Safety: never return non-PDF content as a .pdf download
    const header = buffer.subarray(0, 4).toString('utf8');
    if (header !== '%PDF') {
      const headHex = buffer.subarray(0, 32).toString('hex');
      console.log('PDF invalid header:', { header, len: buffer.length, headHex });
      return res.status(500).json({
        message: 'PDF generation failed (invalid PDF output)',
        ...(process.env.NODE_ENV === 'development'
          ? { details: `header=${JSON.stringify(header)} len=${buffer.length} headHex=${headHex.slice(0, 64)}` }
          : {}),
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Only cache verified PDFs (we validate the first bytes above).
    setCachedPdf(cacheKey, buffer);
    res.send(buffer);
  } catch (err) {
    const details = err && (err.stack || err.message || String(err));
    // Use stdout too (some setups don't surface stderr)
    console.log('PDF generation failed:', details);
    console.error('PDF generation failed:', err);
    res.status(500).json({
      message: 'PDF generation failed',
      details: err?.message || String(err),
    });
  }
};

const downloadExcel = async (req, res) => {
  try {
    // Lazy-require Excel generator to keep startup path lightweight.
    const { generatePOExcel } = require('../utils/excelGenerator');

    const order = await PurchaseOrder.findOne({ _id: req.params.id })
      .select(
        'poNumber status company vendor createdBy approvedByAdmin lineItems shippingAddress vendorAddress '
        + 'department orderDate expectedDeliveryDate totalAmount shippingCost notes terms createdAt updatedAt'
      )
      .populate('vendor', 'name phone taxId')
      .populate('company', 'companyCode phone taxId locations')
      .populate('createdBy', 'name email')
      .populate('approvedByAdmin', 'name email +signatureImage')
      .populate('lineItems.item', 'name sku category unit department')
      .lean();

    if (!order) return res.status(404).json({ message: 'Purchase order not found' });

    if (!['approved_by_admin', 'completed'].includes(order.status)) {
      return res.status(400).json({ message: 'Excel download is only available when the PO is Approved or completed' });
    }

    const assets = getPdfAssets(order);
    const assetBuffers = getPoDocumentAssetBuffers({
      approverSignatureImage: order.approvedByAdmin?.signatureImage || '',
    });

    const safeName = String(order.poNumber || 'purchase-order').replace(/[\\/:*?"<>|]+/g, '-');
    const approverId = order.approvedByAdmin?._id || 'none';
    const cacheKey = `${order._id}:${order.status}:v19:${approverId}:${order.updatedAt?.getTime?.() || order.createdAt?.getTime?.() || 0}`;
    const cachedBuffer = getCachedExcel(cacheKey);
    if (cachedBuffer) {
      setDocDebugHeaders(res, {
        renderVersion: 'v19',
        assets,
        status: order.status,
        cacheKey,
        cached: true,
      });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}.xlsx"`);
      res.setHeader('Content-Length', String(cachedBuffer.length));
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return res.send(cachedBuffer);
    }

    setDocDebugHeaders(res, {
      renderVersion: 'v19',
      assets,
      status: order.status,
      cacheKey,
      cached: false,
    });
    console.log('[PO] Excel signature debug', {
      status: order.status,
      cacheKey,
      adminLen: String(assets.adminSignatureSrc || '').length,
      superLen: String(assets.superadminSignatureSrc || '').length,
      logoLen: String(assets.logoSrc || '').length,
      shreeLen: String(assets.shreeSrc || '').length,
    });

    const buffer = await generatePOExcel(order, assetBuffers);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.xlsx"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    setCachedExcel(cacheKey, buffer);
    res.send(buffer);
  } catch (err) {
    const details = err && (err.stack || err.message || String(err));
    console.log('Excel generation failed:', details);
    console.error('Excel generation failed:', err);
    res.status(500).json({
      message: 'Excel generation failed',
      ...(process.env.NODE_ENV === 'development' ? { details: err?.message || details } : {}),
    });
  }
};

const getDashboardStats = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  // Current Indian financial year window (Apr 1 -> Mar 31)
  const now = new Date();
  const year = now.getFullYear();
  const monthIdx = now.getMonth(); // 0-based
  const fyStartYear = monthIdx >= 3 ? year : year - 1;
  const fyStart = new Date(fyStartYear, 3, 1, 0, 0, 0, 0); // Apr 1
  const fyEnd = new Date(fyStartYear + 1, 2, 31, 23, 59, 59, 999); // Mar 31
  const fyLabel = `${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`;

  // Selected FY-month for company chart: YYYY-MM (must be within current FY)
  const pad2 = (n) => String(n).padStart(2, '0');
  const fyMonths = [];
  for (let m = 4; m <= 12; m += 1) fyMonths.push({ year: fyStartYear, month: m });
  for (let m = 1; m <= 3; m += 1) fyMonths.push({ year: fyStartYear + 1, month: m });
  const fyMonthOptions = fyMonths.map(({ year: y, month: m }) => ({
    value: `${y}-${pad2(m)}`,
    label: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1],
  }));

  const requestedMonth = String(req.query.month || '');
  const defaultMonth = `${year}-${pad2(monthIdx + 1)}`;
  const selectedMonthValue = fyMonthOptions.some((o) => o.value === requestedMonth)
    ? requestedMonth
    : (fyMonthOptions.some((o) => o.value === defaultMonth) ? defaultMonth : fyMonthOptions[0]?.value);
  const dashboardCacheKey = selectedMonthValue || 'default';
  const cachedDashboard = getCachedDashboard(dashboardCacheKey);
  if (cachedDashboard) {
    return res.json(cachedDashboard);
  }

  const [selY, selM] = (selectedMonthValue || '').split('-').map((v) => parseInt(v, 10));
  const monthStart = new Date(selY, (selM || 1) - 1, 1, 0, 0, 0, 0);
  const monthEnd = new Date(selY, (selM || 1), 0, 23, 59, 59, 999);

  const [statusCounts, recentOrders, totalSpend, monthlyExpenses, companyExpenses] = await Promise.all([
    PurchaseOrder.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    PurchaseOrder.find({})
      .select('poNumber status vendor totalAmount orderDate createdAt')
      .populate('vendor', 'name')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    PurchaseOrder.aggregate([
      {
        $match: {
          status: 'completed',
          orderDate: { $gte: fyStart, $lte: fyEnd },
        },
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
    PurchaseOrder.aggregate([
      { $match: { status: 'completed', orderDate: { $gte: fyStart, $lte: fyEnd } } },
      {
        $group: {
          _id: {
            year: { $year: '$orderDate' },
            month: { $month: '$orderDate' },
          },
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
    PurchaseOrder.aggregate([
      { $match: { status: 'completed', orderDate: { $gte: monthStart, $lte: monthEnd } } },
      {
        $group: {
          _id: '$company',
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'companies',
          localField: '_id',
          foreignField: '_id',
          as: 'companyInfo',
        },
      },
      { $unwind: { path: '$companyInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          total: 1,
          count: 1,
          name: { $ifNull: ['$companyInfo.companyCode', '$companyInfo.name'] },
        },
      },
    ]),
  ]);

  const stats = { total: 0, draft: 0, pending: 0, approved_by_admin: 0, rejected: 0, completed: 0, cancelled: 0 };
  statusCounts.forEach(({ _id, count }) => {
    if (_id in stats) stats[_id] = count;
    stats.total += count;
  });

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Fill all 12 FY months (Apr -> Mar), even if there are no orders in a month.
  const monthKey = (y, m) => `${y}-${String(m).padStart(2, '0')}`; // m is 1-12
  const byMonth = new Map(
    monthlyExpenses.map((m) => [monthKey(m._id.year, m._id.month), { amount: m.total, orders: m.count }])
  );

  const monthlyChart = fyMonths.map(({ year: y, month: m }) => {
    const data = byMonth.get(monthKey(y, m)) || { amount: 0, orders: 0 };
    return {
      month: `${MONTH_NAMES[m - 1]}`,
      amount: data.amount,
      orders: data.orders,
    };
  });

  const companyChart = companyExpenses.map((c) => ({
    name: c.name || 'Unknown',
    amount: c.total,
    orders: c.count,
  }));

  const payload = {
    stats,
    recentOrders,
    totalSpend: totalSpend[0]?.total || 0,
    monthlyChart,
    companyChart,
    fyMonthOptions,
    selectedMonth: selectedMonthValue,
    fyLabel,
  };
  setCachedDashboard(dashboardCacheKey, payload);
  res.json(payload);
};

module.exports = {
  getPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  updatePurchaseOrder,
  updateStatus,
  deletePurchaseOrder,
  downloadPDF,
  downloadExcel,
  getDashboardStats,
};
