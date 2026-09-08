import { useCallback, useEffect, useRef, useState } from 'react';
import { orderService } from '../services/orderService';
import { readOrderRequest, saveOrderRequest, clearOrderRequest } from '../utils/requestStorage';
import { orderErrorMessage } from '../utils/orders';
import { ticketStorage } from '../../tickets/utils/storage';

export function useOrderCreation({ userId, onSuccess, service = orderService, storage = ticketStorage() }) {
  const [busy, setBusy] = useState(false);
  const [recovering, setRecovering] = useState(true);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const requestId = useRef(readOrderRequest(userId, storage));
  const mounted = useRef(true);
  const success = useRef(onSuccess);
  success.current = onSuccess;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const finish = useCallback(order => {
    if (!order?.order_code) throw new Error('Missing order code');
    clearOrderRequest(userId, storage);
    requestId.current = null;
    success.current(order);
  }, [userId, storage]);

  const recover = useCallback(async signal => {
    if (!requestId.current) { setRecovering(false); return; }
    const controller = new window.AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timeout = window.setTimeout(abort, 15000);
    setRecovering(true);
    setError('');
    try {
      const existing = await service.findRequest(requestId.current, userId, controller.signal);
      if (mounted.current && !signal?.aborted && existing) finish(existing);
    } catch {
      if (mounted.current && !signal?.aborted) setError('Chưa thể kiểm tra đơn vừa gửi. Vui lòng thử lại.');
    } finally {
      window.clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      if (mounted.current && !signal?.aborted) setRecovering(false);
    }
  }, [service, userId, finish]);

  useEffect(() => {
    const controller = new window.AbortController();
    recover(controller.signal);
    return () => controller.abort();
  }, [recover]);

  async function submit(payload) {
    if (pending.current || recovering) return;
    pending.current = true;
    setBusy(true);
    setError('');
    const controller = new window.AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30000);
    try {
      if (!requestId.current) requestId.current = globalThis.crypto.randomUUID();
      saveOrderRequest(userId, requestId.current, storage);
      // The same request ID is retained on failure, including ambiguous network failures.
      const order = await service.createOrder({ ...payload, requestId: requestId.current }, controller.signal);
      if (mounted.current) finish(order);
    } catch (failure) {
      if (mounted.current) setError(orderErrorMessage(failure));
    } finally {
      window.clearTimeout(timeout);
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return { submit, busy, recovering, error, recover: () => recover(), hasPendingRequest: Boolean(requestId.current) };
}
