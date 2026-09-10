import { RouterProvider } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { router } from './router.jsx';

function App() {
  return <ErrorBoundary><RouterProvider router={router} /></ErrorBoundary>;
}

export default App;
