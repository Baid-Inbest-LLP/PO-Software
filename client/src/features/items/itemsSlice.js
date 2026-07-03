import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { itemsAPI } from '../../services/api';

export const fetchItems = createAsyncThunk(
  'items/fetchAll',
  async (params, { rejectWithValue }) => {
    try {
      const res = await itemsAPI.getAll(params);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch items');
    }
  }
);

export const createItem = createAsyncThunk(
  'items/create',
  async (data, { rejectWithValue }) => {
    try {
      const res = await itemsAPI.create(data);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create item');
    }
  }
);

export const updateItem = createAsyncThunk(
  'items/update',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const res = await itemsAPI.update(id, data);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update item');
    }
  }
);

export const deleteItem = createAsyncThunk(
  'items/delete',
  async (id, { rejectWithValue }) => {
    try {
      await itemsAPI.delete(id);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete item');
    }
  }
);

const itemsSlice = createSlice({
  name: 'items',
  initialState: {
    items: [],
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
      .addCase(fetchItems.pending, (state, action) => {
        state.loading = state.items.length === 0;
        state.error = null;
        state.latestFetchRequestId = action.meta.requestId;
      })
      .addCase(fetchItems.fulfilled, (state, action) => {
        if (state.latestFetchRequestId !== action.meta.requestId) return;
        state.loading = false;
        state.items = action.payload.items;
        state.total = action.payload.total;
        state.page = action.payload.page ?? 1;
        state.pages = action.payload.pages ?? 0;
        state.latestFetchRequestId = null;
      })
      .addCase(fetchItems.rejected, (state, action) => {
        if (state.latestFetchRequestId !== action.meta.requestId) return;
        state.loading = false;
        state.error = action.payload;
        state.latestFetchRequestId = null;
      })
      .addCase(createItem.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
        state.total += 1;
      })
      .addCase(updateItem.fulfilled, (state, action) => {
        const updatedId = String(action.payload?._id);
        const idx = state.items.findIndex((i) => String(i?._id) === updatedId);
        if (idx !== -1) state.items[idx] = action.payload;
      })
      .addCase(deleteItem.fulfilled, (state, action) => {
        const deletedId = String(action.payload);
        state.items = state.items.filter((i) => String(i?._id) !== deletedId);
        state.total -= 1;
      });
  },
});

export const { clearError } = itemsSlice.actions;
export default itemsSlice.reducer;
