import { reconcileSelection, sameSelection, selectionLimit } from '../utils/tickets.js';

export function initialSelection(quantities = {}) {
  return { status: 'loading', concert: null, ticketTypes: [], quantities, now: Date.now(), notice: '' };
}

function reconcile(state, ticketTypes, now) {
  const quantities = reconcileSelection(state.quantities, ticketTypes, now);
  const unchanged = sameSelection(state.quantities, quantities);
  return {
    quantities: unchanged ? state.quantities : quantities, now,
    notice: unchanged ? state.notice : 'Lựa chọn vé đã được điều chỉnh theo tình trạng mở bán và số lượng còn lại.',
  };
}

export function selectionReducer(state, action) {
  switch (action.type) {
    case 'clear': return { ...state, quantities: {}, notice: '' };
    case 'loading': return { ...state, status: 'loading' };
    case 'loaded': return { ...state, ...action.data, ...reconcile(state, action.data.ticketTypes, action.now), status: 'success' };
    case 'error': return { ...state, status: 'error' };
    case 'tick': return state.status === 'success' ? { ...state, ...reconcile(state, state.ticketTypes, action.now) } : state;
    case 'select': {
      if (state.status !== 'success') return state;
      const ticket = state.ticketTypes.find(item => item.id === action.id);
      if (!ticket || !Number.isSafeInteger(action.quantity)) return state;
      const quantities = reconcileSelection(state.quantities, state.ticketTypes, action.now);
      const count = Math.max(0, Math.min(action.quantity, selectionLimit(ticket, action.now)));
      if (count) quantities[action.id] = count;
      else delete quantities[action.id];
      return { ...state, quantities, now: action.now, notice: '' };
    }
    default: return state;
  }
}
