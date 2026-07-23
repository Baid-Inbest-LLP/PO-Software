import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  fetchPurchaseOrder,
  updatePOStatus,
  clearCurrentOrder,
} from '../../features/purchaseOrders/purchaseOrdersSlice';
import { purchaseOrdersAPI } from '../../services/api';
import {
  formatCurrency,
  formatDate,
  STATUS_COLORS,
  STATUS_LABELS,
  downloadBlob,
  amountToWords,
  orderVendorPhysicalForDisplay,
} from '../../utils/helpers';
import ConfirmModal from '../../components/common/ConfirmModal';
import Skeleton, { SkeletonText } from '../../components/common/Skeleton';
import ActivityTimelineSidebar, {
  buildPurchaseOrderTimelineEvents,
} from '../../components/common/ActivityTimelineSidebar';
import toast from 'react-hot-toast';
import excelIcon from '../../../assets/excel.svg';
import pdfIcon from '../../../assets/pdf.svg';

const PurchaseOrderDetail = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { currentOrder: order, loading } = useSelector((state) => state.purchaseOrders);
  const { user } = useSelector((state) => state.auth);
  const isPoAdmin = user?.role === 'PO_ADMIN' || user?.role === 'ADMIN';
  const isSuperadmin = user?.role === 'SUPERADMIN';
  const [downloading, setDownloading] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReasonText, setRejectReasonText] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  useEffect(() => {
    dispatch(fetchPurchaseOrder({ id, fresh: true }));
    return () => dispatch(clearCurrentOrder());
  }, [dispatch, id]);

  const executeConfirmedAction = async () => {
    if (!confirmAction) return;
    const { type, status } = confirmAction;
    setConfirmAction(null);

    if (type === 'status') {
      const result = await dispatch(updatePOStatus({ id, status }));
      if (updatePOStatus.fulfilled.match(result)) {
        toast.success(`Status updated to ${STATUS_LABELS[status]}`);
      } else {
        toast.error(result.payload);
      }
    }
  };

  const cancelConfirm = useCallback(() => setConfirmAction(null), []);

  const closeRejectModal = useCallback(() => {
    setRejectModalOpen(false);
    setRejectReasonText('');
  }, []);

  const submitReject = async () => {
    const trimmed = rejectReasonText.trim();
    if (!trimmed) {
      toast.error('Please enter a rejection reason');
      return;
    }
    setRejectSubmitting(true);
    const result = await dispatch(updatePOStatus({ id, status: 'rejected', rejectionReason: trimmed }));
    setRejectSubmitting(false);
    if (updatePOStatus.fulfilled.match(result)) {
      toast.success(`Status updated to ${STATUS_LABELS.rejected}`);
      closeRejectModal();
    } else {
      toast.error(result.payload);
    }
  };

  const CONFIRM_CONFIG = {
    pending: { title: 'Move to pending', message: 'Move this legacy draft purchase order to pending?', confirmLabel: 'Move', variant: 'primary' },
    approved_by_admin: { title: 'Mark as Completed', message: 'Mark this purchase order as Completed and send it to Superadmin for approval?', confirmLabel: 'Complete', variant: 'primary' },
    completed: { title: 'Approve purchase order', message: 'Approve this purchase order? It can no longer be edited; downloads are available after approval.', confirmLabel: 'Approve', variant: 'primary' },
  };

  const handleDownload = async (type) => {
    setDownloading(type);
    try {
      const res = type === 'pdf'
        ? await purchaseOrdersAPI.downloadPDF(id)
        : await purchaseOrdersAPI.downloadExcel(id);
      downloadBlob(res.data, `${order.poNumber}.${type === 'pdf' ? 'pdf' : 'xlsx'}`);
      toast.success(`${type.toUpperCase()} downloaded`);
    } catch (err) {
      try {
        const data = err?.response?.data;
        if (data && typeof data === 'object' && typeof data.text === 'function') {
          const txt = await data.text();
          const parsed = JSON.parse(txt);
          toast.error(parsed?.details || parsed?.message || 'Download failed');
          return;
        }
        toast.error(err?.response?.data?.message || err?.message || 'Download failed');
      } catch {
        toast.error('Download failed');
      }
    } finally {
      setDownloading(null);
    }
  };

  if (loading || !order) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-8 w-56 mb-2" />
        <div className="card overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-slate-300 to-slate-200" />
          <div className="p-6 space-y-4">
            <div className="flex justify-between gap-4">
              <div className="space-y-3">
                <Skeleton className="h-6 w-40" />
                <SkeletonText lines={3} />
              </div>
              <div className="space-y-2 w-64">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            </div>
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6 space-y-3">
            <Skeleton className="h-5 w-32" />
            <SkeletonText lines={4} />
          </div>
          <div className="card p-6 space-y-3">
            <Skeleton className="h-5 w-32" />
            <SkeletonText lines={4} />
          </div>
        </div>
        <div className="card p-6 space-y-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  const vendorPhysical = orderVendorPhysicalForDisplay(order);

  const isDraft = order.status === 'draft';
  const isPending = order.status === 'pending';
  const isApprovedByAdmin = order.status === 'approved_by_admin';
  const isRejected = order.status === 'rejected';
  const isCompleted = order.status === 'completed';
  const canDownload = isApprovedByAdmin || isCompleted;
  const lineItems = order.lineItems || [];

  const calcDiscountAmt = (item) => {
    const base = (Number(item?.quantity) || 0) * (Number(item?.unitPrice) || 0);
    return base * ((Number(item?.discount) || 0) / 100);
  };

  const calcGstAmt = (item) => {
    const base = (Number(item?.quantity) || 0) * (Number(item?.unitPrice) || 0);
    const discounted = base - calcDiscountAmt(item);
    return discounted * ((Number(item?.gstRate) || 0) / 100);
  };

  const calcPreGstAmount = (item) => {
    const base = (Number(item?.quantity) || 0) * (Number(item?.unitPrice) || 0);
    return base - calcDiscountAmt(item);
  };

  const totals = lineItems.reduce((acc, item) => {
    const qty = Number(item?.quantity) || 0;
    const discountAmt = calcDiscountAmt(item);
    const amount = calcPreGstAmount(item);
    const gstAmt = Number(item?.gstAmount) > 0 ? Number(item.gstAmount) : calcGstAmt(item);
    const lineTotal = Math.round(amount + gstAmt);

    return {
      qty: acc.qty + qty,
      preGst: acc.preGst + amount,
      discount: acc.discount + discountAmt,
      gst: acc.gst + gstAmt,
      total: acc.total + lineTotal,
    };
  }, { qty: 0, preGst: 0, discount: 0, gst: 0, total: 0 });

  const roundedSubtotal = Math.round(totals.preGst);
  const roundedGstTotal = Math.round(totals.gst);
  const roundedItemsTotal = totals.total;
  const roundedGrandTotal = Math.round(order.totalAmount || totals.total);
  // Line table: keep full decimals. Summary / footer: whole-rupee rounding.
  const formatExactAmount = (amount) => formatCurrency(Number(amount) || 0);
  const formatRoundedAmount = (amount) =>
    formatCurrency(Math.round(Number(amount) || 0)).replace(/\.00$/, '');
  const formatCurrencyDisplay = formatRoundedAmount;

  const statusGradient = {
    draft: 'from-gray-500 to-gray-600',
    pending: 'from-amber-500 to-orange-500',
    approved_by_admin: 'from-emerald-500 to-green-600',
    rejected: 'from-red-500 to-rose-600',
    completed: 'from-blue-500 to-indigo-600',
    cancelled: 'from-gray-400 to-gray-500',
  };

  const timelineEvents = buildPurchaseOrderTimelineEvents(order);

  return (
    <div className="expense-view-page w-full max-w-[90rem] mx-auto space-y-6">

      {/* ── Back button ── */}
      <button
        onClick={() => navigate('/purchase-orders')}
        className="expense-view-back-btn group"
      >
        <svg className="w-4 h-4 transition-transform duration-150 group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Purchase Order
      </button>

      <div className="expense-view-layout">
        <div className="min-w-0 space-y-6">

          {/* ── Hero Card — PO info + dates + actions ── */}
          <div className="card overflow-hidden">
            {/* Gradient accent */}
            <div className={`h-1.5 bg-gradient-to-r ${statusGradient[order.status] || statusGradient.pending}`} />

            <div className="p-6">
              {/* Top row: PO info + action buttons */}
              <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{order.poNumber}</h1>
                    <span className={`${STATUS_COLORS[order.status]} !text-xs`}>{STATUS_LABELS[order.status]}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {isDraft && (
                    <>
                      <Link to={`/purchase-orders/${id}/edit`} className="btn-secondary text-sm">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        Edit
                      </Link>
                      {isPoAdmin && (
                        <>
                          <button type="button" onClick={() => { setRejectReasonText(''); setRejectModalOpen(true); }} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            Reject
                          </button>
                          <button type="button" onClick={() => setConfirmAction({ type: 'status', status: 'pending' })} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            Approve
                          </button>
                        </>
                      )}
                    </>
                  )}
                  {isPending && (
                    <>
                      <Link to={`/purchase-orders/${id}/edit`} className="btn-secondary text-sm">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        Edit
                      </Link>
                      {isPoAdmin && (
                        <>
                          <button type="button" onClick={() => { setRejectReasonText(''); setRejectModalOpen(true); }} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            Reject
                          </button>
                          <button type="button" onClick={() => setConfirmAction({ type: 'status', status: 'approved_by_admin' })} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Complete
                          </button>
                        </>
                      )}
                    </>
                  )}
                  {isApprovedByAdmin && (
                    <>
                      {isSuperadmin && (
                        <>
                          <button type="button" onClick={() => setConfirmAction({ type: 'status', status: 'completed' })} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Approve
                          </button>
                        </>
                      )}
                    </>
                  )}
                  {canDownload && (
                    <>
                      <button onClick={() => handleDownload('pdf')} disabled={downloading === 'pdf'} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50">
                        <img src={pdfIcon} alt="PDF" className="w-4 h-4" />
                        {downloading === 'pdf' ? 'Downloading...' : 'Download PDF'}
                      </button>
                      <button onClick={() => handleDownload('excel')} disabled={downloading === 'excel'} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors disabled:opacity-50">
                        <img src={excelIcon} alt="Excel" className="w-4 h-4" />
                        {downloading === 'excel' ? 'Downloading...' : 'Download Excel'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {isRejected && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50/80 px-4 py-3">
                  <p className="text-[11px] font-bold text-red-700 uppercase tracking-wider mb-1.5">Rejection reason</p>
                  <p className="text-sm text-red-900 leading-relaxed whitespace-pre-wrap">
                    {order.rejectionReason?.trim() ? order.rejectionReason : 'No reason was recorded for this rejection.'}
                  </p>
                </div>
              )}

              {/* Divider */}
              <div className="border-t border-gray-100 pt-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4.5 h-4.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400 uppercase font-semibold tracking-wider">Order Date</p>
                      <p className="text-sm text-gray-900 font-semibold mt-0.5">{formatDate(order.orderDate) || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4.5 h-4.5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400 uppercase font-semibold tracking-wider">Delivery Date</p>
                      <p className="text-sm text-gray-900 font-semibold mt-0.5">{formatDate(order.expectedDeliveryDate) || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4.5 h-4.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400 uppercase font-semibold tracking-wider">Items</p>
                      <p className="text-sm text-gray-900 font-semibold mt-0.5">{order.lineItems?.length || 0} line item{(order.lineItems?.length || 0) !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 320 512" fill="currentColor"><path d="M308 96c6.627 0 12-5.373 12-12V44c0-6.627-5.373-12-12-12H12C5.373 32 0 37.373 0 44v44.748c0 6.627 5.373 12 12 12h85.28c27.308 0 48.261 9.958 60.97 27.252H12c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h158.757c-6.217 36.086-36.075 58.952-72.757 58.952H12c-6.627 0-12 5.373-12 12v53.012c0 3.349 1.4 6.546 3.861 8.818l165.052 152.356a12.001 12.001 0 0 0 8.139 3.182h82.562c10.924 0 16.166-13.408 8.139-20.818L116.871 319.906c76.499-2.34 131.144-53.395 138.318-127.906H308c6.627 0 12-5.373 12-12v-40c0-6.627-5.373-12-12-12h-48.19c-3.003-11.891-7.922-23.738-14.932-34H308z" /></svg>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400 uppercase font-semibold tracking-wider">Total Amount</p>
                      <p className="text-lg text-gray-700 font-bold mt-0.5 tracking-tight">{formatCurrencyDisplay(roundedGrandTotal)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Vendor & Ship To ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Vendor</h3>
              </div>
              <p className="font-bold text-gray-900 text-base">{order.vendor?.name}</p>
              {order.vendor?.contactPerson && (
                <p className="text-sm text-gray-600 mt-1">
                  Contact Person: {order.vendor.contactPerson}
                </p>
              )}
              {order.vendor?.phone && (
                <div className="flex items-center gap-1.5 mt-3 text-sm text-gray-500">
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {order.vendor.phone}
                </div>
              )}
              <div className="flex items-start gap-2 mt-2 text-sm text-gray-500">
                <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div className="space-y-0.5">
                  {vendorPhysical?.label && (
                    <p className="text-xs font-semibold text-gray-600">
                      {(vendorPhysical.label || '').toUpperCase()}
                    </p>
                  )}
                  {vendorPhysical?.street && <p>{vendorPhysical.street}</p>}
                  {vendorPhysical?.city && (
                    <p>
                      {vendorPhysical.city}
                      {vendorPhysical.state ? `, ${vendorPhysical.state}` : ''} {vendorPhysical.zipCode}
                    </p>
                  )}
                  {vendorPhysical?.country && <p>{vendorPhysical.country}</p>}
                </div>
              </div>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Ship To</h3>
              </div>
              <div className="flex items-center gap-2">
                {order.company?.name && <p className="font-bold text-gray-900 text-base">{order.company.name}</p>}
                {order.shippingAddress?.label && (
                  <span className="inline-block text-xs font-semibold text-primary-700 bg-primary-50 border border-primary-200 px-2 py-0.5 rounded-md mt-1 mb-1">
                    {order.shippingAddress.label?.toUpperCase?.() || ''}
                  </span>
                )}</div>
              {order.company?.phone && (
                <div className="flex items-center gap-1.5 mt-3 text-sm text-gray-500">
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {order.company.phone}
                </div>
              )}
              <div className="flex items-start gap-2 mt-2 text-sm text-gray-500">
                <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div className="space-y-0.5">
                  {order.shippingAddress?.street && <p>{order.shippingAddress.street}</p>}
                  {order.shippingAddress?.city && (
                    <p>{order.shippingAddress.city}{order.shippingAddress.state ? `, ${order.shippingAddress.state}` : ''} {order.shippingAddress.zipCode}</p>
                  )}
                  {order.shippingAddress?.country && <p>{order.shippingAddress.country}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* ── Order Items ── */}
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <h3 className="font-bold text-gray-800">Order Items</h3>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th className="text-center w-10">#</th>
                    <th className="text-left">Description</th>
                    <th className="text-right">Qty</th>
                    <th className="text-center">Unit</th>
                    <th className="text-right">Unit Price</th>
                    <th className="text-right">Disc %</th>
                    <th className="text-right">Disc Amt</th>
                    <th className="text-right">Amount</th>
                    <th className="text-right">GST %</th>
                    <th className="text-right">GST Amt</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
              {lineItems.map((item, idx) => {
                const discountAmt = calcDiscountAmt(item);
                const amount = calcPreGstAmount(item);
                const gstAmt = Number(item?.gstAmount) > 0 ? Number(item.gstAmount) : calcGstAmt(item);
                const lineTotal = Math.round(amount + gstAmt);
                return (
                  <tr key={idx}>
                    <td className="text-center text-gray-400 font-medium">{idx + 1}</td>
                    <td className="text-left font-medium text-gray-800">{item.description}</td>
                    <td className="text-right font-medium">{item.quantity}</td>
                    <td className="text-center text-gray-500">{item.unit}</td>
                    <td className="text-right">{formatExactAmount(item.unitPrice)}</td>
                    <td className="text-right text-gray-500">{item.discount > 0 ? `${item.discount}%` : ''}</td>
                    <td className="text-right text-red-700 font-medium">{discountAmt > 0 ? formatExactAmount(discountAmt) : ''}</td>
                    <td className="text-right font-semibold text-slate-700">{formatExactAmount(amount)}</td>
                    <td className="text-right text-gray-500">{item.gstRate > 0 ? `${item.gstRate}%` : ''}</td>
                    <td className="text-right text-emerald-700 font-medium">{gstAmt > 0 ? formatExactAmount(gstAmt) : ''}</td>
                    <td className="text-right font-bold text-gray-900">{formatRoundedAmount(lineTotal)}</td>
                  </tr>
                );
              })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-blue-50">
                    <td className="text-center text-gray-400 align-middle text-base py-2 px-4"></td>
                    <td className="text-left font-bold text-gray-800 align-middle text-2xl py-2 px-4">Totals</td>
                    <td className="text-right font-bold text-gray-800 align-middle text-base py-2 px-4"></td>
                    <td className="text-center text-gray-400 align-middle text-base py-2 px-4"></td>
                    <td className="text-right text-gray-400 align-middle text-base py-2 px-4"></td>
                    <td className="text-right text-gray-400 align-middle text-base py-2 px-4"></td>
                    <td className="text-right font-bold text-red-700 align-middle text-base py-2 px-4"></td>
                    <td className="text-right font-bold text-slate-700 align-middle text-base py-2 px-4"></td>
                    <td className="text-right text-gray-400 align-middle text-base py-3 px-4"></td>
                    <td className="text-right font-bold text-emerald-700 align-middle text-base py-2 px-4"></td>
                    <td className="text-right font-bold text-primary-700 align-middle text-lg py-2 px-4">{formatRoundedAmount(roundedItemsTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* ── Summary: Amount in Words (left) + Totals (right) ── */}
            <div className="border-t border-gray-100 p-6">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                {/* Left — Amount in Words */}
                <div className="flex-1 max-w-lg">
                  <div className="bg-gradient-to-br from-primary-50 to-blue-50 border border-primary-200 rounded-xl px-5 py-4">
                    <p className="text-[11px] text-primary-500 uppercase font-bold tracking-wider mb-2">Amount in Words</p>
                    <p className="text-base text-primary-900 font-bold leading-relaxed">
                      {amountToWords(roundedGrandTotal)}
                    </p>
                  </div>
                </div>

                {/* Right — Totals (match MER: Subtotal without GST, then GST, then Grand Total) */}
                <div className="w-80 space-y-3 ">
                  {/* <div className="flex justify-between text-sm">
                <span className="text-gray-500 font-medium">Subtotal</span>
                <span className="font-bold text-gray-800 text-base">{formatRoundedAmount(roundedSubtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 font-medium">GST</span>
                <span className="font-bold text-emerald-700 text-base">{formatRoundedAmount(roundedGstTotal)}</span>
              </div> */}
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-gray-900 text-lg">Grand Total</span>
                    <span className="text-2xl font-bold text-primary-700 tracking-tight">{formatRoundedAmount(roundedGrandTotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 font-medium">Shipping</span>
                    <span className="font-bold text-gray-800 text-base">{formatRoundedAmount(order.shippingCost)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Notes & Terms ── */}
          {(order.notes || order.terms) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {order.notes && (
                <div className="card p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-sky-50 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Notes</h3>
                  </div>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{order.notes}</p>
                </div>
              )}
              {order.terms && (
                <div className="card p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Terms & Conditions</h3>
                  </div>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{order.terms}</p>
                </div>
              )}
            </div>
          )}

        </div>

        <ActivityTimelineSidebar events={timelineEvents} />
      </div>

      <ConfirmModal
        open={!!confirmAction}
        title={CONFIRM_CONFIG[confirmAction?.status]?.title}
        message={CONFIRM_CONFIG[confirmAction?.status]?.message}
        confirmLabel={CONFIRM_CONFIG[confirmAction?.status]?.confirmLabel}
        variant={CONFIRM_CONFIG[confirmAction?.status]?.variant}
        onConfirm={executeConfirmedAction}
        onCancel={cancelConfirm}
      />

      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-gray-100"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-po-title"
          >
            <div className="flex items-start justify-between p-6 border-b border-gray-100">
              <div>
                <h2 id="reject-po-title" className="text-lg font-bold text-gray-900">Reject purchase order</h2>
                <p className="text-sm text-gray-500 mt-1">Provide a reason for rejection. It will be visible on this PO.</p>
              </div>
              <button
                type="button"
                onClick={closeRejectModal}
                disabled={rejectSubmitting}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg disabled:opacity-50"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="reject-reason" className="block text-sm font-medium text-gray-700 mb-1.5">Reason</label>
                <textarea
                  id="reject-reason"
                  className="input-field min-h-[120px] resize-y"
                  placeholder="Explain why this purchase order is being rejected…"
                  value={rejectReasonText}
                  onChange={(e) => setRejectReasonText(e.target.value)}
                  maxLength={2000}
                  disabled={rejectSubmitting}
                />
                <p className="text-xs text-gray-400 mt-1">{rejectReasonText.length}/2000</p>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeRejectModal} disabled={rejectSubmitting} className="btn-secondary">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => submitReject()}
                  disabled={rejectSubmitting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {rejectSubmitting ? 'Rejecting…' : 'Reject PO'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrderDetail;
