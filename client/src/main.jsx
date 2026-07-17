import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { store } from './app/store';
import { THEME_STORAGE_KEY } from './features/ui/uiSlice';
import AppProviders from './components/providers/AppProviders';
import App from './App';
import './index.css';

const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <AppProviders>
        <App />
      </AppProviders>
    </Provider>
  </React.StrictMode>
);
