import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { fetchDashboard } from '../features/purchaseOrders/purchaseOrdersSlice';
import { formatCurrency, formatDate, formatInLac, STATUS_COLORS, STATUS_LABELS } from '../utils/helpers';
import CustomSelect from '../components/common/CustomSelect';
import PageBanner from '../components/common/PageBanner';
import Skeleton, { SkeletonText } from '../components/common/Skeleton';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#ec4899', '#f97316', '#6366f1', '#14b8a6'];

const StatCard = ({ label, value, color, iconBg, icon, accent }) => (
  <div className="card w-full p-3 sm:p-4 xl:p-5 max-[1660px]:p-4 max-[1536px]:p-3 max-[1366px]:p-[10px] max-[1280px]:p-2.5 flex items-center gap-2 sm:gap-3 xl:gap-4 max-[1660px]:gap-2.5 max-[1536px]:gap-2 max-[1366px]:gap-1.5 group hover:shadow-md transition-shadow duration-200 relative overflow-hidden">
    <div className={`absolute top-0 left-0 w-full h-1 ${accent}`} />
    <div className={`w-10 h-10 sm:w-12 sm:h-12 xl:w-14 xl:h-14 max-[1660px]:w-12 max-[1660px]:h-12 max-[1536px]:w-11 max-[1536px]:h-11 max-[1366px]:w-10 max-[1366px]:h-10 max-[1280px]:w-9 max-[1280px]:h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
      {icon}
    </div>
    <div className="min-w-0">
      <p className={`text-2xl sm:text-3xl xl:text-4xl max-[1660px]:text-3xl max-[1536px]:text-[1.7rem] max-[1366px]:text-2xl max-[1280px]:text-xl font-bold max-[1660px]:font-semibold tracking-tight leading-none ${color}`}>{value}</p>
      <p className="text-sm sm:text-base xl:text-lg max-[1660px]:text-base max-[1536px]:text-sm max-[1366px]:text-[13px] max-[1280px]:text-xs text-gray-500 font-semibold max-[1366px]:font-medium mt-1 max-[1366px]:mt-0.5 leading-snug">{label}</p>
    </div>
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-semibold text-gray-800">
          {p.name === 'amount' ? formatCurrency(p.value) : `${p.value} orders`}
        </p>
      ))}
    </div>
  );
};

const Dashboard = () => {
  const dispatch = useDispatch();
  const { dashboard, loading } = useSelector((state) => state.purchaseOrders);
  const [selectedMonth, setSelectedMonth] = useState('');

  useEffect(() => {
    dispatch(fetchDashboard());
  }, [dispatch]);

  useEffect(() => {
    if (dashboard?.selectedMonth) setSelectedMonth(dashboard.selectedMonth);
  }, [dashboard?.selectedMonth]);

  if (loading && !dashboard) {
    return (
      <div className="space-y-4 sm:space-y-5">
        <div className="grid grid-cols-4 max-[1365px]:grid-cols-2 gap-3 sm:gap-4 max-[1660px]:gap-3 max-[1366px]:gap-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="flex-1">
                <Skeleton className="h-5 w-16 mb-2" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[11fr_9fr] min-[1441px]:grid-cols-3 gap-4 sm:gap-5">
          <div className="card lg:col-span-1 min-[1441px]:col-span-2 p-4 space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="card lg:col-span-1 min-[1441px]:col-span-1 p-4 space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[11fr_9fr] min-[1441px]:grid-cols-3 gap-4 sm:gap-5">
          <div className="card lg:col-span-1 min-[1441px]:col-span-2 p-4 space-y-3">
            <Skeleton className="h-5 w-40" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-lg" />
                  <SkeletonText lines={2} />
                </div>
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
          </div>
          <div className="card lg:col-span-1 min-[1441px]:col-span-1 p-4 space-y-3">
            <Skeleton className="h-5 w-40" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-8" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const stats = dashboard?.stats || {};
  const monthlyChart = dashboard?.monthlyChart || [];
  const companyChart = dashboard?.companyChart || [];
  const fyMonthOptions = dashboard?.fyMonthOptions || [];
  const fyLabel = dashboard?.fyLabel || '';

  const STATUS_BAR_COLORS = {
    pending: 'bg-amber-500',
    approved_by_admin: 'bg-emerald-500',
    completed: 'bg-blue-500',
    rejected: 'bg-red-500',
  };

  const STATUS_BREAKDOWN_ORDER = ['pending', 'approved_by_admin', 'completed', 'rejected'];

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* <PageBanner
        title="Welcome back!"
        subtitle="Here's an overview of your purchase orders and expenses."
        action={{ to: '/purchase-orders/new', label: 'New Purchase Order' }}
      /> */}

      {/* Stats */}
      <div className="grid grid-cols-4 max-[1365px]:grid-cols-2 gap-3 sm:gap-4 max-[1660px]:gap-3 max-[1366px]:gap-2.5">
        <StatCard
          label="Total Orders" value={stats.total || 0}
          color="text-blue-700" iconBg="bg-blue-100" accent="bg-blue-500"
          icon={<svg className="w-5 h-5 sm:w-6 sm:h-6 xl:w-7 xl:h-7 max-[1660px]:w-6 max-[1660px]:h-6 max-[1536px]:w-5 max-[1536px]:h-5 max-[1366px]:w-[18px] max-[1366px]:h-[18px] max-[1280px]:w-4 max-[1280px]:h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
        />
        <StatCard
          label="Pending" value={stats.pending || 0}
          color="text-amber-700" iconBg="bg-amber-100" accent="bg-amber-500"
          icon={<svg className="w-5 h-5 sm:w-6 sm:h-6 xl:w-7 xl:h-7 max-[1660px]:w-6 max-[1660px]:h-6 max-[1536px]:w-5 max-[1536px]:h-5 max-[1366px]:w-[18px] max-[1366px]:h-[18px] max-[1280px]:w-4 max-[1280px]:h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard
          label="Approved" value={stats.completed || 0}
          color="text-emerald-700" iconBg="bg-emerald-100" accent="bg-emerald-500"
          icon={<svg className="w-5 h-5 sm:w-6 sm:h-6 xl:w-7 xl:h-7 max-[1660px]:w-6 max-[1660px]:h-6 max-[1536px]:w-5 max-[1536px]:h-5 max-[1366px]:w-[18px] max-[1366px]:h-[18px] max-[1280px]:w-4 max-[1280px]:h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard
          label="Total Spend"
          value={formatInLac(dashboard?.totalSpend)}
          color="text-purple-700" iconBg="bg-purple-100" accent="bg-purple-500"
          icon={<svg className="w-5 h-5 sm:w-6 sm:h-6 xl:w-7 xl:h-7 max-[1660px]:w-6 max-[1660px]:h-6 max-[1536px]:w-5 max-[1536px]:h-5 max-[1366px]:w-[18px] max-[1366px]:h-[18px] max-[1280px]:w-4 max-[1280px]:h-4 text-purple-600" viewBox="0 0 320 512" fill="currentColor"><path d="M308 96c6.627 0 12-5.373 12-12V44c0-6.627-5.373-12-12-12H12C5.373 32 0 37.373 0 44v44.748c0 6.627 5.373 12 12 12h85.28c27.308 0 48.261 9.958 60.97 27.252H12c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h158.757c-6.217 36.086-36.075 58.952-72.757 58.952H12c-6.627 0-12 5.373-12 12v53.012c0 3.349 1.4 6.546 3.861 8.818l165.052 152.356a12.001 12.001 0 0 0 8.139 3.182h82.562c10.924 0 16.166-13.408 8.139-20.818L116.871 319.906c76.499-2.34 131.144-53.395 138.318-127.906H308c6.627 0 12-5.373 12-12v-40c0-6.627-5.373-12-12-12h-48.19c-3.003-11.891-7.922-23.738-14.932-34H308z" /></svg>}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-[11fr_9fr] min-[1441px]:grid-cols-3 gap-4 sm:gap-5">
        {/* Monthly Expenses — Bar Chart */}
        <div className="card lg:col-span-1 min-[1441px]:col-span-2 overflow-hidden">
          <div className="px-4 sm:px-6 py-3 sm:py-4 max-[1440px]:sm:px-4 max-[1440px]:sm:py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-sm sm:text-base lg:text-lg xl:text-xl font-semibold text-gray-700 tracking-tight">Monthly PO Expenses</h3>
          </div>
          <div className="p-4" style={{ height: 300 }}>
            {monthlyChart.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-gray-400">
                No expense data available yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 16, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 16, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={false}
                    shared={false}
                    isAnimationActive={false}
                    wrapperStyle={{ transition: 'none' }}
                  />
                  <Bar
                    dataKey="amount"
                    name="amount"
                    fill="#3b82f6"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={40}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Company-wise Expenses — Pie Chart */}
        <div className="card lg:col-span-1 min-[1441px]:col-span-1 overflow-hidden">
          <div className="px-4 sm:px-6 py-3 sm:py-4 max-[1440px]:sm:px-4 max-[1440px]:sm:py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-purple-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-2 sm:gap-3 lg:flex-nowrap min-w-0">
              <h3 className="text-sm sm:text-base lg:text-lg xl:text-xl font-semibold text-gray-700 tracking-tight whitespace-nowrap">
                Company wise
              </h3>
              <div className="w-full sm:w-24 lg:w-20 xl:w-24 shrink-0">
                <CustomSelect
                  size="sm"
                  placeholder="Select month"
                  value={selectedMonth}
                  onChange={(val) => {
                    setSelectedMonth(val);
                    dispatch(fetchDashboard({ month: val }));
                  }}
                  options={fyMonthOptions}
                />
              </div>
            </div>
          </div>
          <div className="p-4" style={{ height: 300 }}>
            {companyChart.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-gray-400">
                No company data available yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={companyChart}
                    dataKey="amount"
                    nameKey="name"
                    cx="50%" cy="45%"
                    innerRadius={50} outerRadius={85}
                    paddingAngle={2}
                    cornerRadius={3}
                    stroke="#ffffff"
                    strokeWidth={2}
                  >
                    {companyChart.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    iconSize={8}
                    formatter={(val) => <span className="text-sm text-gray-600 font-semibold">{val}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Recent orders (left) + Status breakdown (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-[11fr_9fr] min-[1441px]:grid-cols-3 gap-4 sm:gap-5">
        {/* Recent orders */}
        <div className="card lg:col-span-1 min-[1441px]:col-span-2 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-indigo-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-sm sm:text-base lg:text-lg xl:text-xl font-semibold text-gray-700 tracking-tight">Recent Purchase Orders</h3>
            </div>
            <Link to="/purchase-orders" className="text-base text-primary-700 font-semibold hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {dashboard?.recentOrders?.length === 0 && (
              <div className="px-6 py-10 text-center">
                <svg className="w-10 h-10 text-gray-200 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm text-gray-400">No purchase orders yet</p>
              </div>
            )}
            {dashboard?.recentOrders?.slice(0, 3).map((order) => (
              <Link
                key={order._id}
                to={`/purchase-orders/${order._id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gray-100 group-hover:bg-primary-100 transition-colors flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-gray-500 group-hover:text-primary-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">{order.poNumber}</p>
                    <p className="text-xs text-gray-500">{order.vendor?.name} · {formatDate(order.orderDate)}</p>
                  </div>
                </div>
                <div className="text-right flex items-center gap-3">
                  <div>
                    <p className="text-sm font-bold text-gray-800">{formatCurrency(Math.round(Number(order.totalAmount) || 0)).replace(/\.00$/, '')}</p>
                    <span className={`${STATUS_COLORS[order.status]} !text-[10px]`}>{STATUS_LABELS[order.status]}</span>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 group-hover:text-primary-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Status breakdown */}
        <div className="card lg:col-span-1 min-[1441px]:col-span-1 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-emerald-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-sm sm:text-base lg:text-lg xl:text-xl font-semibold text-gray-700 tracking-tight">Status Breakdown</h3>
          </div>
          <div className="p-5 space-y-4">
            {STATUS_BREAKDOWN_ORDER.map((s) => {
              const count = stats[s] || 0;
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
              return (
                <div key={s}>
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <span className={`${STATUS_COLORS[s]} shrink-0`}>{STATUS_LABELS[s]}</span>
                    <span className="text-base font-bold text-gray-900 tabular-nums">{count}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${STATUS_BAR_COLORS[s]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
