import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { vendorsAPI } from '../../services/api';

export const fetchVendors = createAsyncThunk(
  'vendors/fetchAll',
  async (params, { rejectWithValue }) => {
    try {
      const res = await vendorsAPI.getAll(params);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch vendors');
    }
  }
);

export const createVendor = createAsyncThunk(
  'vendors/create',
  async (data, { rejectWithValue }) => {
    try {
      const res = await vendorsAPI.create(data);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create vendor');
    }
  }
);

export const updateVendor = createAsyncThunk(
  'vendors/update',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const res = await vendorsAPI.update(id, data);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update vendor');
    }
  }
);

export const deleteVendor = createAsyncThunk(
  'vendors/delete',
  async (id, { rejectWithValue }) => {
    try {
      await vendorsAPI.delete(id);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete vendor');
    }
  }
);

const vendorsSlice = createSlice({
  name: 'vendors',
  initialState: {
    vendors: [],
    total: 0,
    page: 1,
    pages: 0,
    loading: false,
    error: null,
    latestFetchRequestId: null,
  },
  reducers: {
    clearError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchVendors.pending, (state, action) => {
        state.loading = state.vendors.length === 0;
        state.error = null;
        state.latestFetchRequestId = action.meta.requestId;
      })
      .addCase(fetchVendors.fulfilled, (state, action) => {
        if (state.latestFetchRequestId !== action.meta.requestId) return;
        state.loading = false;
        state.vendors = action.payload.vendors;
        state.total = action.payload.total;
        state.page = action.payload.page ?? 1;
        state.pages = action.payload.pages ?? 0;
        state.latestFetchRequestId = null;
      })
      .addCase(fetchVendors.rejected, (state, action) => {
        if (state.latestFetchRequestId !== action.meta.requestId) return;
        state.loading = false;
        state.error = action.payload;
        state.latestFetchRequestId = null;
      })
      .addCase(createVendor.fulfilled, (state, action) => {
        state.vendors.unshift(action.payload);
        state.total += 1;
      })
      .addCase(updateVendor.fulfilled, (state, action) => {
        const updatedId = String(action.payload?._id);
        const idx = state.vendors.findIndex((v) => String(v?._id) === updatedId);
        if (idx !== -1) state.vendors[idx] = action.payload;
      })
      .addCase(deleteVendor.fulfilled, (state, action) => {
        const deletedId = String(action.payload);
        state.vendors = state.vendors.filter((v) => String(v?._id) !== deletedId);
        state.total -= 1;
      });
  },
});

export const { clearError } = vendorsSlice.actions;
export default vendorsSlice.reducer;
