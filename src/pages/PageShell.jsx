import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function PageShell({ eyebrow, title, description }) {
  return <section className="site-container section-space min-h-[55vh]"><p className="eyebrow">{eyebrow}</p><h1 className="page-title">{title}</h1><p className="body-copy mt-6 max-w-2xl">{description}</p><Link to="/" className="text-link mt-10"><ArrowLeft size={18} />Về trang chủ</Link></section>;
}
