import { useCallback, useEffect, useState } from 'react';
import { digitalTicketService } from '../services/digitalTicketService';

export function useDigitalTickets({ mode, userId, code, page = 0, service = digitalTicketService }) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({ status: 'loading', data: null });
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  const key = JSON.stringify([mode, userId, code, page]);
  useEffect(() => {
    let active = true;
    const controller = new window.AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    setResult({ status: 'loading', data: null });
    Promise.resolve().then(() => {
      if (mode === 'verify') return service.verifyTicket(code, controller.signal);
      if (mode === 'detail') return service.getMyTicketByCode(code, userId, controller.signal);
      return service.getMyTickets(userId, page, controller.signal);
    }).then(data => {
      if (active) setResult({ status: 'success', data, key });
    }).catch(() => {
      if (active) setResult({ status: 'error', data: null });
    }).finally(() => window.clearTimeout(timeout));
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [mode, userId, code, page, service, key, attempt]);
  useEffect(() => {
    window.addEventListener('focus', retry);
    return () => window.removeEventListener('focus', retry);
  }, [retry]);
  if (result.status === 'success' && result.key !== key) return { status: 'loading', data: null, retry };
  return { ...result, retry };
}
