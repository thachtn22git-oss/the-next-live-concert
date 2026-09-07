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
      { path: 'checkout', element: <CheckoutPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'my-tickets', element: <MyTicketsPage /> },
      { path: 'admin', element: <AdminDashboardPage /> },
    ],
  },
]);
