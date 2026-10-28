import { Outlet } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Toaster } from '@/components/Toaster';

export function App() {
  return (
    <>
      <Header />
      <Outlet />
      <Toaster />
    </>
  );
}
