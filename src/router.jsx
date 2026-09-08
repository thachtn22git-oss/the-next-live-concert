import { createBrowserRouter } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import MainLayout from './layouts/MainLayout.jsx';
import AdminDashboardPage from './pages/AdminDashboardPage.jsx';
import ArtistDetailPage from './pages/ArtistDetailPage.jsx';
import ArtistsPage from './pages/ArtistsPage.jsx';
import ConcertPage from './pages/ConcertPage.jsx';
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import SchedulePage from './pages/SchedulePage.jsx';
import TicketsPage from './pages/TicketsPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import DataState from './components/DataState.jsx';

const CheckoutPage = lazy(() => import('./pages/CheckoutPage.jsx'));
const OrderSuccessPage = lazy(() => import('./pages/OrderSuccessPage.jsx'));
const MyTicketsPage = lazy(() => import('./pages/MyTicketsPage.jsx'));
const MyTicketDetailPage = lazy(() => import('./pages/MyTicketDetailPage.jsx'));
const VerifyTicketPage = lazy(() => import('./pages/VerifyTicketPage.jsx'));

const orderLoading = <section className="site-container section-space"><DataState status="loading" /></section>;

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
      { path: 'checkout', element: <ProtectedRoute><Suspense fallback={orderLoading}><CheckoutPage /></Suspense></ProtectedRoute> },
      { path: 'order-success/:orderCode', element: <ProtectedRoute><Suspense fallback={orderLoading}><OrderSuccessPage /></Suspense></ProtectedRoute> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
      { path: 'profile', element: <ProtectedRoute><ProfilePage /></ProtectedRoute> },
      { path: 'my-tickets', element: <ProtectedRoute><Suspense fallback={orderLoading}><MyTicketsPage /></Suspense></ProtectedRoute> },
      { path: 'my-tickets/:ticketCode', element: <ProtectedRoute><Suspense fallback={orderLoading}><MyTicketDetailPage /></Suspense></ProtectedRoute> },
      { path: 'verify-ticket/:token', element: <Suspense fallback={orderLoading}><VerifyTicketPage /></Suspense> },
      { path: 'admin', element: <ProtectedRoute requiredRole="admin"><AdminDashboardPage /></ProtectedRoute> },
    ],
  },
]);
