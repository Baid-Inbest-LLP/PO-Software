import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { purchaseOrdersAPI } from '../../services/api';

export const fetchPurchaseOrders = createAsyncThunk(
  'purchaseOrders/fetchAll',
  async (params, { rejectWithValue }) => {
    try {
      const res = await purchaseOrdersAPI.getAll(params);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch purchase orders');
    }
  }
);

export const fetchPurchaseOrder = createAsyncThunk(
  'purchaseOrders/fetchOne',
  async (arg, { rejectWithValue }) => {
    try {
      const id = typeof arg === 'string' ? arg : arg?.id;
      const fresh = typeof arg === 'object' ? !!arg?.fresh : false;
      const res = await purchaseOrdersAPI.getOne(id, { fresh });
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch purchase order');
    }
  }
);

export const createPurchaseOrder = createAsyncThunk(
  'purchaseOrders/create',
  async (data, { rejectWithValue }) => {
    try {
      const res = await purchaseOrdersAPI.create(data);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create purchase order');
    }
  }
);

export const updatePurchaseOrder = createAsyncThunk(
  'purchaseOrders/update',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const res = await purchaseOrdersAPI.update(id, data);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update purchase order');
    }
  }
);

export const updatePOStatus = createAsyncThunk(
  'purchaseOrders/updateStatus',
  async ({ id, status, rejectionReason }, { rejectWithValue }) => {
    try {
      const body = { status };
      if (rejectionReason !== undefined) body.rejectionReason = rejectionReason;
      const res = await purchaseOrdersAPI.updateStatus(id, body);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update status');
    }
  }
);

export const deletePurchaseOrder = createAsyncThunk(
  'purchaseOrders/delete',
  async (id, { rejectWithValue }) => {
    try {
      await purchaseOrdersAPI.delete(id);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete purchase order');
    }
  }
);

export const fetchDashboard = createAsyncThunk(
  'purchaseOrders/dashboard',
  async (params, { rejectWithValue }) => {
    try {
      const res = await purchaseOrdersAPI.getDashboard(params);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch dashboard');
    }
  }
);

const purchaseOrdersSlice = createSlice({
  name: 'purchaseOrders',
  initialState: {
    orders: [],
    currentOrder: null,
    total: 0,
    page: 1,
    pages: 0,
    dashboard: null,
    loading: false,
    error: null,
  },
  reducers: {
    clearCurrentOrder: (state) => { state.currentOrder = null; },
    clearError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPurchaseOrders.pending, (state) => { state.loading = state.orders.length === 0; state.error = null; })
      .addCase(fetchPurchaseOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.orders = action.payload.orders;
        state.total = action.payload.total;
        state.page = action.payload.page ?? 1;
        state.pages = action.payload.pages ?? 0;
      })
      .addCase(fetchPurchaseOrders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchPurchaseOrder.pending, (state) => { state.loading = true; })
      .addCase(fetchPurchaseOrder.fulfilled, (state, action) => {
        state.loading = false;
        state.currentOrder = action.payload;
      })
      .addCase(fetchPurchaseOrder.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(createPurchaseOrder.fulfilled, (state, action) => {
        state.orders.unshift(action.payload);
        state.total += 1;
      })
      .addCase(updatePurchaseOrder.fulfilled, (state, action) => {
        const idx = state.orders.findIndex((o) => o._id === action.payload._id);
        if (idx !== -1) state.orders[idx] = action.payload;
        state.currentOrder = action.payload;
      })
      .addCase(updatePOStatus.fulfilled, (state, action) => {
        const idx = state.orders.findIndex((o) => o._id === action.payload._id);
        if (idx !== -1) {
          state.orders[idx] = { ...state.orders[idx], ...action.payload };
        }
        // Always write-through the just-updated PO so detail view reflects approval instantly.
        state.currentOrder = state.currentOrder?._id === action.payload._id
          ? { ...state.currentOrder, ...action.payload }
          : action.payload;
      })
      .addCase(deletePurchaseOrder.fulfilled, (state, action) => {
        state.orders = state.orders.filter((o) => o._id !== action.payload);
        state.total -= 1;
      })
      .addCase(fetchDashboard.pending, (state) => {
        state.loading = !state.dashboard;
        state.error = null;
      })
      .addCase(fetchDashboard.fulfilled, (state, action) => {
        state.loading = false;
        state.dashboard = action.payload;
      })
      .addCase(fetchDashboard.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearCurrentOrder, clearError } = purchaseOrdersSlice.actions;
export default purchaseOrdersSlice.reducer;
