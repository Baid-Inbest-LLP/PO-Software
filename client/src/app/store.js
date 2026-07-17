import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import companiesReducer from '../features/companies/companiesSlice';
import vendorsReducer from '../features/vendors/vendorsSlice';
import itemsReducer from '../features/items/itemsSlice';
import purchaseOrdersReducer from '../features/purchaseOrders/purchaseOrdersSlice';
import uiReducer from '../features/ui/uiSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    companies: companiesReducer,
    vendors: vendorsReducer,
    items: itemsReducer,
    purchaseOrders: purchaseOrdersReducer,
    ui: uiReducer,
  },
});
