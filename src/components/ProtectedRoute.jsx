import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import DataState from './DataState';

export default function ProtectedRoute({ children, requiredRole }) {
  const { status, user, profile, profileStatus, retryAuth, retryProfile } = useAuth();
  const location = useLocation();
  if (status !== 'ready') return <div className="site-container"><DataState status={status === 'loading' ? 'loading' : 'error'} retry={retryAuth} /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (requiredRole && profileStatus !== 'ready') return <div className="site-container"><DataState status={profileStatus === 'loading' ? 'loading' : 'error'} retry={retryProfile} /></div>;
  if (requiredRole && profile?.role !== requiredRole) return <section className="site-container section-space"><h1 className="page-title">Không có quyền truy cập</h1><p className="body-copy mt-6">Tài khoản của bạn không có quyền truy cập trang này.</p></section>;
  return children ?? <Outlet />;
}
