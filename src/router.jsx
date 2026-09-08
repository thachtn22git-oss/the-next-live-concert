import { createBrowserRouter } from 'react-router-dom';
import MainLayout from './layouts/MainLayout.jsx';
import AdminDashboardPage from './pages/AdminDashboardPage.jsx';
import ArtistDetailPage from './pages/ArtistDetailPage.jsx';
import ArtistsPage from './pages/ArtistsPage.jsx';
import CheckoutPage from './pages/CheckoutPage.jsx';
import ConcertPage from './pages/ConcertPage.jsx';
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import MyTicketsPage from './pages/MyTicketsPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import SchedulePage from './pages/SchedulePage.jsx';
import TicketsPage from './pages/TicketsPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'concert', element: <ConcertPage /> },
      { path: 'artists', element: <ArtistsPage /> },
      { path: 'artists/:slug', element: <ArtistDetailPage /> },
      { path: 'schedule', element: <SchedulePage /> },
      { path: 'tickets', element: <TicketsPage /> },
      { path: 'checkout', element: <ProtectedRoute><CheckoutPage /></ProtectedRoute> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
      { path: 'profile', element: <ProtectedRoute><ProfilePage /></ProtectedRoute> },
      { path: 'my-tickets', element: <ProtectedRoute><MyTicketsPage /></ProtectedRoute> },
      { path: 'admin', element: <ProtectedRoute requiredRole="admin"><AdminDashboardPage /></ProtectedRoute> },
    ],
  },
]);
