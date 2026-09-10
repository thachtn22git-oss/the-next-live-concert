import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './router.jsx';
import './styles.css';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import AuthProvider from './contexts/AuthProvider.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary><AuthProvider><RouterProvider router={router} /></AuthProvider></ErrorBoundary>
  </React.StrictMode>,
);
