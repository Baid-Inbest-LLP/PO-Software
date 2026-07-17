import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { Toaster } from 'react-hot-toast';
import { fetchAvatar, fetchMe } from '../../features/auth/authSlice';

const Layout = ({ children }) => {
  const dispatch = useDispatch();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    dispatch(fetchMe()).then((action) => {
      if (fetchMe.fulfilled.match(action) && action.payload?.hasAvatar) {
        dispatch(fetchAvatar());
      }
    });
  }, [dispatch]);

  return (
    <div className="app-layout flex h-screen overflow-hidden bg-gray-50">
      <Sidebar isOpen={sidebarOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { fontSize: '14px', borderRadius: '8px' },
        }}
      />
    </div>
  );
};

export default Layout;
