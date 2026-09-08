import { useContext } from 'react';
import { TicketSelectionContext } from '../context/TicketSelectionContext';

export function useTicketSelection() {
  const context = useContext(TicketSelectionContext);
  if (!context) throw new Error('useTicketSelection requires TicketSelectionProvider');
  return context;
}
