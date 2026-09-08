import { RefreshCw } from 'lucide-react';

export default function TicketDataState({ status, empty, retry }) {
  if (status === 'loading') return <div role="status" className="py-10"><p className="body-copy">Đang tải thông tin vé...</p><div className="mt-6 h-1 w-24 animate-pulse bg-concert-cyan motion-reduce:animate-none" aria-hidden="true" /></div>;
  if (status === 'error') return <div role="alert" className="py-10"><p className="body-copy">Chưa thể tải thông tin vé. Vui lòng thử lại.</p><button className="text-link mt-5" type="button" onClick={retry}><RefreshCw size={16} aria-hidden="true" />Thử lại</button></div>;
  if (empty) return <p role="status" className="body-copy py-10">Hiện chưa có hạng vé được mở bán.</p>;
  return null;
}
