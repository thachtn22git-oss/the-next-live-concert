import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export default function AuthRecoveryRedirect() {
  const { recoveryRequired } = useAuth();
  const { pathname } = useLocation();
  return recoveryRequired && pathname !== '/reset-password' ? <Navigate replace to="/reset-password" /> : null;
}
