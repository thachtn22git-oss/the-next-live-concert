import { useEffect, useState, useCallback } from 'react';
export function useAdminData(loader) {
  const [attempt,setAttempt] = useState(0); const [state,setState] = useState({ loading: true, data: null, error: null });
  const retry = useCallback(() => setAttempt(v => v + 1),[]);
  useEffect(() => { let active = true; setState({ loading:true,data:null,error:null }); Promise.resolve().then(loader).then(data => { if (active) setState({ loading:false,data,error:null }); }).catch(error => { if (active) setState({ loading:false,data:null,error }); }); return () => { active = false; }; },[loader,attempt]);
  return { ...state,retry };
}
