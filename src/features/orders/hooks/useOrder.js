import { useCallback, useEffect, useState } from 'react';
import { orderService } from '../services/orderService';

export function useOrder(orderCode, userId, service = orderService) {
  const [result, setResult] = useState({ status: 'loading', order: null });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  useEffect(() => {
    let active = true;
    const controller = new window.AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    setResult({ status: 'loading', order: null });
    Promise.resolve().then(() => service.getOrder(orderCode, userId, controller.signal)).then(order => {
      if (active) setResult({ status: 'success', order, orderCode, userId });
    }).catch(() => {
      if (active) setResult({ status: 'error', order: null });
    }).finally(() => window.clearTimeout(timeout));
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [orderCode, userId, service, attempt]);
  if (result.status === 'success' && (result.orderCode !== orderCode || result.userId !== userId)) return { status: 'loading', order: null, retry };
  return { ...result, retry };
}
