import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useConcert } from '../../../hooks/useConcert.js';
import { formatConcertDate } from '../../../utils/concert.js';
import { concertImage } from '../data/home';

export default function Hero() {
  const { concert } = useConcert();
  return <section className="hero">
    <img className="hero-image" src={concertImage} alt="Ánh đèn sân khấu rực sáng trên đám đông tại một đêm nhạc minh họa" fetchPriority="high" />
    <div className="hero-shade" />
    <div className="site-container hero-content"><div className="hero-topline"><span>{concert?.venue || "Việt Nam"}</span><span>Hẹn nhau trong âm nhạc</span></div>
      <p className="eyebrow text-concert-yellow">Sự kiện âm nhạc</p>
      <h1>THE NEXT<span>LIVE CONCERT</span></h1>
      <div className="hero-bottom"><div><p className="hero-copy">Âm nhạc không chỉ để nghe.<br />Đó là khoảnh khắc để sống.</p><div className="mt-7 flex flex-wrap gap-3"><Link to="/tickets" className="button button-pink">Mua vé ngay <ArrowUpRight size={18} /></Link><Link to="/concert" className="button button-outline">Khám phá sự kiện <ArrowUpRight size={18} /></Link></div></div><div className="hero-date"><span>{formatConcertDate(concert?.starts_at)}</span><p>{concert?.venue || "Địa điểm sẽ được công bố"}</p><small>{concert?.is_sample ? "Thông tin dự kiến" : concert?.name}</small></div></div>
    </div>
  </section>;
}
