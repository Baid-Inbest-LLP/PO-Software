import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { fetchPurchaseOrders, deletePurchaseOrder } from '../../features/purchaseOrders/purchaseOrdersSlice';
import { formatCurrency, formatDate, STATUS_COLORS, STATUS_LABELS, downloadBlob } from '../../utils/helpers';
import { purchaseOrdersAPI } from '../../services/api';
import CustomSelect from '../../components/common/CustomSelect';
import Pagination, { TABLE_PAGE_SIZE } from '../../components/common/Pagination';
import PageBanner from '../../components/common/PageBanner';
import ConfirmModal from '../../components/common/ConfirmModal';
import Skeleton, { SkeletonText } from '../../components/common/Skeleton';
import toast from 'react-hot-toast';
import excelIcon from '../../../assets/excel.svg';
import pdfIcon from '../../../assets/pdf.svg';

const DOWNLOADABLE_STATUSES = ['pending', 'approved_by_admin', 'completed'];
const DELETABLE_STATUSES = ['pending', 'draft'];

const PurchaseOrderList = () => {
  const dispatch = useDispatch();
  const { orders, total, pages, loading } = useSelector((state) => state.purchaseOrders);
  const { user } = useSelector((state) => state.auth);
  const canDeletePo = user?.role === 'PO_ADMIN' || user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [downloading, setDownloading] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const formatRoundedCurrency = (amount) =>
    formatCurrency(Math.round(Number(amount) || 0)).replace(/\.00$/, '');

  useEffect(() => {
    dispatch(fetchPurchaseOrders({ search, status, page, limit: TABLE_PAGE_SIZE }));
  }, [dispatch, search, status, page]);

  const handleDownload = async (id, poNumber, type) => {
    setDownloading(`${id}-${type}`);
    try {
      const res = type === 'pdf'
        ? await purchaseOrdersAPI.downloadPDF(id)
        : await purchaseOrdersAPI.downloadExcel(id);
      downloadBlob(res.data, `${poNumber}.${type === 'pdf' ? 'pdf' : 'xlsx'}`);
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

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const result = await dispatch(deletePurchaseOrder(confirmDelete.id));
    setConfirmDelete(null);
    if (deletePurchaseOrder.fulfilled.match(result)) {
      toast.success('Purchase order deleted');
      dispatch(fetchPurchaseOrders({ search, status, page, limit: TABLE_PAGE_SIZE }));
    } else {
      toast.error(result.payload);
    }
  };

  const cancelDelete = useCallback(() => setConfirmDelete(null), []);

  return (
    <div>
      <PageBanner
        className="mb-4"
        title="Purchase Order"
        subtitle={`Total · ${total}`}
        action={{ to: '/purchase-orders/new', label: 'New PO' }}
      />

      {/* Filters */}
      <div className="card p-4 mb-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-48">
          <input
            className="input-field"
            placeholder="Search by PO number..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <CustomSelect
          className="w-48"
          placeholder="All Statuses"
          value={status}
          onChange={(val) => {
            setStatus(val);
            setPage(1);
          }}
          options={[
            { value: '', label: 'All Statuses' },
            ...Object.entries(STATUS_LABELS).map(([val, label]) => ({ value: val, label })),
          ]}
        />
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th className="text-left">PO Number</th>
                  <th className="text-center">Company</th>
                  <th className="text-center">Vendor</th>
                  <th className="text-center">Order Date</th>
                  <th className="text-center">Delivery Date</th>
                  <th className="text-right">Total</th>
                  <th className="text-center">Status</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2"><Skeleton className="h-4 w-28" /></td>
                    <td className="px-3 py-2 text-center"><Skeleton className="h-4 w-20 mx-auto" /></td>
                    <td className="px-3 py-2 text-center"><Skeleton className="h-4 w-32 mx-auto" /></td>
                    <td className="px-3 py-2 text-center"><Skeleton className="h-4 w-20 mx-auto" /></td>
                    <td className="px-3 py-2 text-center"><Skeleton className="h-4 w-20 mx-auto" /></td>
                    <td className="px-3 py-2 text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                    <td className="px-3 py-2 text-center"><Skeleton className="h-5 w-20 mx-auto rounded-full" /></td>
                    <td className="px-3 py-2 text-center"><Skeleton className="h-4 w-16 mx-auto" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-500 font-medium">No purchase orders found</p>
            <p className="text-sm text-gray-400 mt-1">Create your first purchase order to get started</p>
            <Link to="/purchase-orders/new" className="btn-primary mt-4 inline-flex">Create PO</Link>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th className="text-left">PO Number</th>
                  <th className="text-center">Company</th>
                  <th className="text-center">Vendor</th>
                  <th className="text-center">Order Date</th>
                  <th className="text-center">Delivery Date</th>
                  <th className="text-right">Total</th>
                  <th className="text-center">Status</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order._id}>
                    <td className="text-left">
                      <Link to={`/purchase-orders/${order._id}`} className="font-semibold text-primary-700 hover:underline">
                        {order.poNumber}
                      </Link>
                    </td>
                    <td className="text-center">
                      <span className="font-mono text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200 px-2 py-0.5 rounded-md">
                        {order.company?.companyCode || order.company?.name || '—'}
                      </span>
                    </td>
                    <td className="text-center text-gray-600">{order.vendor?.name || '—'}</td>
                    <td className="text-center text-gray-500">{formatDate(order.orderDate)}</td>
                    <td className="text-center text-gray-500">{formatDate(order.expectedDeliveryDate)}</td>
                    <td className="text-right font-semibold">{formatRoundedCurrency(order.totalAmount)}</td>
                    <td className="text-center">
                      <span className={STATUS_COLORS[order.status]}>{STATUS_LABELS[order.status]}</span>
                    </td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {/* View — always enabled */}
                        <Link
                          to={`/purchase-orders/${order._id}`}
                          className="p-1.5 text-primary-600 hover:text-primary-800 rounded transition-colors"
                          title="View"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </Link>

                        {/* PDF — enabled from pending onward */}
                        <button
                          onClick={() => DOWNLOADABLE_STATUSES.includes(order.status) && handleDownload(order._id, order.poNumber, 'pdf')}
                          disabled={!DOWNLOADABLE_STATUSES.includes(order.status) || downloading === `${order._id}-pdf`}
                          className={`p-1.5 rounded ${
                            DOWNLOADABLE_STATUSES.includes(order.status)
                              ? ''
                              : 'opacity-40 grayscale cursor-not-allowed'
                          }`}
                          title={DOWNLOADABLE_STATUSES.includes(order.status) ? 'Download PDF' : 'PDF available when status is Pending, Approved, or Completed'}
                        >
                          <img src={pdfIcon} alt="PDF" className="w-4 h-4" />
                        </button>

                        {/* Excel — enabled from pending onward */}
                        <button
                          onClick={() => DOWNLOADABLE_STATUSES.includes(order.status) && handleDownload(order._id, order.poNumber, 'excel')}
                          disabled={!DOWNLOADABLE_STATUSES.includes(order.status) || downloading === `${order._id}-excel`}
                          className={`p-1.5 rounded ${
                            DOWNLOADABLE_STATUSES.includes(order.status)
                              ? ''
                              : 'opacity-40 grayscale cursor-not-allowed'
                          }`}
                          title={DOWNLOADABLE_STATUSES.includes(order.status) ? 'Download Excel' : 'Excel available when status is Pending, Approved, or Completed'}
                        >
                          <img src={excelIcon} alt="Excel" className="w-4 h-4" />
                        </button>

                        {/* Delete — pending/draft, Admin & Superadmin only */}
                        {canDeletePo && DELETABLE_STATUSES.includes(order.status) && (
                          <button
                            type="button"
                            onClick={() => setConfirmDelete({ id: order._id, poNumber: order.poNumber })}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && orders.length > 0 && (
          <Pagination
            page={page}
            pages={pages}
            total={total}
            pageSize={TABLE_PAGE_SIZE}
            loading={loading}
            onPageChange={setPage}
          />
        )}
      </div>

      <ConfirmModal
        open={!!confirmDelete}
        title="Delete purchase order"
        message={`Are you sure you want to delete "${confirmDelete?.poNumber}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
};

export default PurchaseOrderList;
