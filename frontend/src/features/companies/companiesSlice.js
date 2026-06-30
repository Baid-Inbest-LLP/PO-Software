import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { companiesAPI } from '../../services/api';

export const fetchCompanies = createAsyncThunk(
  'companies/fetchAll',
  async (params, { rejectWithValue }) => {
    try {
      const res = await companiesAPI.getAll(params);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch companies');
    }
  }
);

export const fetchCompany = createAsyncThunk(
  'companies/fetchOne',
  async (id, { rejectWithValue }) => {
    try {
      const res = await companiesAPI.getOne(id);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch company');
    }
  }
);

export const createCompany = createAsyncThunk(
  'companies/create',
  async (data, { rejectWithValue }) => {
    try {
      const res = await companiesAPI.create(data);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create company');
    }
  }
);

export const updateCompany = createAsyncThunk(
  'companies/update',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const res = await companiesAPI.update(id, data);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update company');
    }
  }
);

export const deleteCompany = createAsyncThunk(
  'companies/delete',
  async (id, { rejectWithValue }) => {
    try {
      await companiesAPI.delete(id);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete company');
    }
  }
);

const companiesSlice = createSlice({
  name: 'companies',
  initialState: {
    companies: [],
    currentCompany: null,
    total: 0,
    loading: false,
    error: null,
  },
  reducers: {
    clearError: (state) => { state.error = null; },
    clearCurrentCompany: (state) => { state.currentCompany = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCompanies.pending, (state) => { state.loading = state.companies.length === 0; state.error = null; })
      .addCase(fetchCompanies.fulfilled, (state, action) => {
        state.loading = false;
        state.companies = action.payload.companies;
        state.total = action.payload.total;
      })
      .addCase(fetchCompanies.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchCompany.fulfilled, (state, action) => {
        state.currentCompany = action.payload;
      })
      .addCase(createCompany.fulfilled, (state, action) => {
        state.companies.unshift(action.payload);
        state.total += 1;
      })
      .addCase(updateCompany.fulfilled, (state, action) => {
        const idx = state.companies.findIndex((c) => c._id === action.payload._id);
        if (idx !== -1) state.companies[idx] = action.payload;
        if (state.currentCompany?._id === action.payload._id) {
          state.currentCompany = action.payload;
        }
      })
      .addCase(deleteCompany.fulfilled, (state, action) => {
        state.companies = state.companies.filter((c) => c._id !== action.payload);
        state.total -= 1;
      });
  },
});

export const { clearError, clearCurrentCompany } = companiesSlice.actions;
export default companiesSlice.reducer;
