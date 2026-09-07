import { useContext } from 'react';
import { ConcertContext } from '../contexts/ConcertContext';

export function useConcert() {
  const context = useContext(ConcertContext);
  if (!context) throw new Error('useConcert must be used within ConcertProvider.');
  return context;
}
