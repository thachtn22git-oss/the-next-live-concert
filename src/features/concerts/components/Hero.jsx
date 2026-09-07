import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { concertImage } from '../data/home';

export default function Hero() {
  return <section className="hero">
    <img className="hero-image" src={concertImage} alt="Ánh đèn sân khấu rực sáng trên đám đông tại một đêm nhạc minh họa" fetchPriority="high" />
    <div className="hero-shade" />
    <div className="site-container hero-content"><div className="hero-topline"><span>Đà Nẵng • Việt Nam</span><span>Hẹn nhau trong âm nhạc</span></div>
      <p className="eyebrow text-concert-yellow">Sự kiện âm nhạc / 2026</p>
      <h1>THE NEXT<span>LIVE CONCERT</span></h1>
      <div className="hero-bottom"><div><p className="hero-copy">Âm nhạc không chỉ để nghe.<br />Đó là khoảnh khắc để sống.</p><div className="mt-7 flex flex-wrap gap-3"><Link to="/tickets" className="button button-pink">Mua vé ngay <ArrowUpRight size={18} /></Link><Link to="/concert" className="button button-outline">Khám phá sự kiện <ArrowUpRight size={18} /></Link></div></div><div className="hero-date"><span>21.11.2026</span><p>ĐÀ NẴNG</p><small>Thời gian dự kiến</small></div></div>
    </div>
  </section>;
}
