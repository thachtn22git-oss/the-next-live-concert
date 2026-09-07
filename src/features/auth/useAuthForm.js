import { useRef, useState } from 'react';
import { authErrorMessage } from './errors';

export function useAuthForm(initialValues) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  function change(event) {
    const { name, value } = event.target;
    setValues(previous => ({ ...previous, [name]: value }));
    setErrors(previous => ({ ...previous, [name]: '' }));
    setError('');
  }
  async function run(action) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try { await action(); } catch (failure) { setError(authErrorMessage(failure)); }
    finally { pending.current = false; setBusy(false); }
  }
  return { values, errors, setErrors, error, setError, busy, change, run };
}
