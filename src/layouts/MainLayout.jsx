import { Outlet } from 'react-router-dom';
import Footer from '../components/Footer.jsx';
import Navbar from '../components/Navbar.jsx';
import ConcertProvider from '../contexts/ConcertProvider.jsx';
import AuthRecoveryRedirect from '../features/auth/AuthRecoveryRedirect.jsx';
import TicketSelectionProvider from '../features/tickets/context/TicketSelectionProvider.jsx';

function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <AuthRecoveryRedirect />
      <Navbar />
      <main id="main-content" className="flex-1" tabIndex={-1}>
        <ConcertProvider><TicketSelectionProvider><Outlet /></TicketSelectionProvider></ConcertProvider>
      </main>
      <Footer />
    </div>
  );
}

export default MainLayout;
