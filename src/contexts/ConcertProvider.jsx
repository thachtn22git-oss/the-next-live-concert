import { useCallback, useEffect, useState } from 'react';
import { ConcertContext } from './ConcertContext';
import { fetchConcertProgram } from '../services/concertService';

export default function ConcertProvider({ children }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ status: 'loading', concert: null, artists: [], schedules: [] });
  const retry = useCallback(() => {
    setState({ status: 'loading', concert: null, artists: [], schedules: [] });
    setAttempt(value => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new window.AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    fetchConcertProgram({ signal: controller.signal })
      .then(data => {
        if (active) setState({ status: 'success', ...data });
      })
      .catch(() => {
        if (active) setState({ status: 'error', concert: null, artists: [], schedules: [] });
      })
      .finally(() => window.clearTimeout(timeout));
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [attempt]);

  return <ConcertContext.Provider value={{ ...state, retry }}>{children}</ConcertContext.Provider>;
}
