import { useCallback, useEffect, useReducer, useRef } from 'react';
import { CONCERT_SLUG } from '../../../constants/concert';
import { fetchTicketCatalog } from '../services/ticketService';
import { readSelection, writeSelection, ticketStorage } from '../utils/storage';
import { selectionSummary } from '../utils/tickets';
import { initialSelection, selectionReducer } from './selectionReducer';
import { TicketSelectionContext } from './TicketSelectionContext';

export default function TicketSelectionProvider({ children, slug = CONCERT_SLUG, loader = fetchTicketCatalog, storage = ticketStorage() }) {
  const [state, dispatch] = useReducer(selectionReducer, null, () => initialSelection(readSelection(slug, storage)));
  const request = useRef(null);
  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new window.AbortController();
    request.current = controller;
    dispatch({ type: 'loading' });
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const data = await loader({ signal: controller.signal, slug });
      if (request.current !== controller) return null;
      dispatch({ type: 'loaded', data, now: Date.now() });
      return data;
    } catch {
      if (request.current === controller) dispatch({ type: 'error' });
      return null;
    } finally { window.clearTimeout(timeout); }
  }, [loader, slug]);

  useEffect(() => {
    refresh();
    const onFocus = () => { refresh(); };
    const timer = window.setInterval(() => dispatch({ type: 'tick', now: Date.now() }), 1000);
    window.addEventListener('focus', onFocus);
    return () => {
      const current = request.current;
      request.current = null;
      current?.abort();
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  useEffect(() => {
    // Keep saved selection during loading/errors; reconcile only against a successful response.
    if (state.status === 'success') writeSelection(slug, state.quantities, storage);
  }, [state.status, state.quantities, slug, storage]);

  const setQuantity = useCallback((id, quantity) => dispatch({ type: 'select', id, quantity, now: Date.now() }), []);
  const clearSelection = useCallback(() => {
    writeSelection(slug, {}, storage);
    dispatch({ type: 'clear' });
  }, [slug, storage]);
  const summary = selectionSummary(state.quantities, state.ticketTypes, state.now);
  return <TicketSelectionContext.Provider value={{ ...state, summary, refresh, setQuantity, clearSelection }}>{children}</TicketSelectionContext.Provider>;
}
