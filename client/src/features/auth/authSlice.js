import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authAPI } from '../../services/api';

const user = JSON.parse(localStorage.getItem('user') || 'null');
const token = localStorage.getItem('token');

const persistUser = (nextUser) => {
  if (nextUser) localStorage.setItem('user', JSON.stringify(nextUser));
};

export const register = createAsyncThunk('auth/register', async (data, { rejectWithValue }) => {
  try {
    const res = await authAPI.register(data);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Registration failed');
  }
});

export const login = createAsyncThunk('auth/login', async (data, { rejectWithValue }) => {
  try {
    const res = await authAPI.login(data);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Login failed');
  }
});

export const fetchMe = createAsyncThunk('auth/fetchMe', async (_, { rejectWithValue }) => {
  try {
    const res = await authAPI.getMe();
    persistUser(res.data);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to load profile');
  }
});

export const fetchAvatar = createAsyncThunk('auth/fetchAvatar', async (_, { getState, rejectWithValue }) => {
  try {
    if (!getState().auth.user?.hasAvatar) return '';
    const res = await authAPI.getAvatar();
    return res.data?.avatarPreview || '';
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to load photo');
  }
});

export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (data, { rejectWithValue }) => {
    try {
      const res = await authAPI.updateProfile(data);
      const payload = res.data;
      // Support both avatar update shape { user, avatarPreview } and legacy user doc
      if (payload?.user) {
        persistUser(payload.user);
        return {
          user: payload.user,
          avatarPreview: payload.avatarPreview || '',
        };
      }
      persistUser(payload);
      return { user: payload, avatarPreview: undefined };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Update failed');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: user || null,
    token: token || null,
    avatarPreview: '',
    isAuthenticated: !!token,
    loading: false,
    error: null,
  },
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.avatarPreview = '';
      state.isAuthenticated = false;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    const handlePending = (state) => {
      state.loading = true;
      state.error = null;
    };
    const handleAuth = (state, action) => {
      state.loading = false;
      state.error = null;
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
      state.avatarPreview = '';
      localStorage.setItem('token', action.payload.token);
      localStorage.setItem('user', JSON.stringify(action.payload.user));
    };
    const handleRejected = (state, action) => {
      state.loading = false;
      state.error = action.payload;
    };

    builder
      .addCase(register.pending, handlePending)
      .addCase(register.fulfilled, handleAuth)
      .addCase(register.rejected, handleRejected)
      .addCase(login.pending, handlePending)
      .addCase(login.fulfilled, handleAuth)
      .addCase(login.rejected, handleRejected)
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.user = action.payload;
        state.isAuthenticated = true;
        if (!action.payload?.hasAvatar) state.avatarPreview = '';
      })
      .addCase(fetchAvatar.fulfilled, (state, action) => {
        state.avatarPreview = action.payload || '';
      })
      .addCase(updateProfile.pending, handlePending)
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        if (action.payload.avatarPreview !== undefined) {
          state.avatarPreview = action.payload.avatarPreview || '';
        }
      })
      .addCase(updateProfile.rejected, handleRejected);
  },
});

export const { logout, clearError } = authSlice.actions;
export default authSlice.reducer;
