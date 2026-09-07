import { RefreshCw } from 'lucide-react';

export default function DataState({ status, empty, retry, emptyMessage = 'Thông tin sẽ sớm được công bố.' }) {
  if (status === 'loading') return <div className="py-10" role="status" aria-live="polite">
    <p className="body-copy">Đang tải thông tin...</p>
    <div className="mt-6 h-1 w-24 animate-pulse bg-concert-cyan motion-reduce:animate-none" aria-hidden="true" />
  </div>;
  if (status === 'error') return <div className="py-10" role="alert">
    <p className="body-copy">Chưa thể tải thông tin. Vui lòng thử lại sau.</p>
    <button type="button" className="text-link mt-5" onClick={retry}><RefreshCw size={16} aria-hidden="true" />Thử lại</button>
  </div>;
  if (empty) return <p role="status" className="body-copy py-10">{emptyMessage}</p>;
  return null;
}
