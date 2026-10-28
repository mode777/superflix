import { useAdminAuthStore } from './lib/authStore';
import { SignInView } from './SignInView';

export function AdminGate({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAdminAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <SignInView />;
}
