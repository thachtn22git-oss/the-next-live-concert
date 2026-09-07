import { ArrowUpRight, MapPin, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { artists, schedule, tickets, faqs } from '../data/home';

export function AboutSection() {
  return <section className="site-container section-space about-section"><p className="eyebrow">01 / Về The Next</p><div><h2>Một đêm âm nhạc.<br /><span className="text-muted">Hàng nghìn cảm xúc.</span></h2><p className="body-copy mt-7 max-w-xl">The Next Live Concert là nơi âm nhạc, ánh sáng và những nghệ sĩ bạn yêu thích cùng tạo nên một đêm đáng nhớ. Đến để hòa vào đám đông. Ở lại vì những giai điệu không muốn kết thúc.</p><Link className="text-link mt-7" to="/concert">Câu chuyện của The Next <ArrowUpRight size={18} /></Link></div></section>;
}
export function ArtistSection() {
  return <section className="artists-band section-space"><div className="site-container"><div className="section-heading"><div><p className="eyebrow">02 / Dàn nghệ sĩ</p><h2>Những âm sắc.<br />Cùng một nhịp đập.</h2></div><div><p className="body-copy max-w-xs">Những cái tên sẽ xuất hiện tại The Next Live Concert đang dần được hé lộ.</p><Link className="text-link mt-5" to="/artists">Xem nghệ sĩ <ArrowUpRight size={18} /></Link></div></div><div className="artist-grid">{artists.map(artist => <article key={artist.id} className="artist-item"><div className="artist-image-wrap"><img src={artist.image} alt={artist.alt} loading="lazy" /><span className="artist-status">Sắp công bố</span></div><div className="artist-caption"><span>{artist.id}</span><div><p className="eyebrow">{artist.category}</p><h3>{artist.name}</h3></div></div></article>)}</div><p className="mt-5 text-xs text-muted">Hình ảnh minh họa. Danh sách nghệ sĩ chính thức sẽ được công bố sau.</p></div></section>;
}
export function ScheduleSection() {
  return <section className="site-container section-space schedule-section"><div><p className="eyebrow">03 / Lịch trình dự kiến</p><h2>Từ nhịp đầu tiên.<br />Đến phút cuối cùng.</h2><Link to="/schedule" className="text-link mt-7">Xem lịch trình <ArrowUpRight size={18} /></Link></div><ol className="schedule-list">{schedule.map(([time, title, description]) => <li key={time}><time>{time}</time><div><h3>{title}</h3><p>{description}</p></div><span className="schedule-dot" /></li>)}</ol></section>;
}
export function TicketSection() {
  return <section className="ticket-band section-space"><div className="site-container"><div className="section-heading"><div><p className="eyebrow">04 / Hạng vé</p><h2>Chọn trải nghiệm<br />của bạn.</h2></div><p className="body-copy max-w-xs">Mỗi vị trí, một cảm xúc riêng.<br />Hạng vé và giá tham khảo. Chưa mở bán.</p></div><div className="ticket-grid">{tickets.map(ticket => <article className={'concert-pass ' + ticket.color} key={ticket.id}><div className="pass-top"><span>THE NEXT / 2026</span><span>{ticket.id}</span></div><h3>{ticket.name}</h3><p className="pass-price">{ticket.price}<span>đ</span></p><ul>{ticket.benefits.map(benefit => <li key={benefit}>{benefit}</li>)}</ul><div className="pass-bottom"><span>21.11 / ĐÀ NẴNG</span><Link to="/tickets" aria-label={'Xem hạng vé ' + ticket.name}><ArrowUpRight size={24} /></Link></div></article>)}</div><Link to="/tickets" className="text-link mt-8">Thông tin mở bán <ArrowUpRight size={18} /></Link></div></section>;
}
export function VenueSection() {
  return <section className="venue-band"><div className="site-container section-space venue-inner"><div><p className="eyebrow">05 / Điểm hẹn</p><h2>ĐÀ NẴNG.</h2><p className="venue-subtitle">Thành phố biển.<br />Một đêm thật khác.</p></div><div className="venue-details"><MapPin size={30} strokeWidth={1.5} /><h3>Hẹn bạn tại Đà Nẵng</h3><p>Thông tin địa điểm sẽ được cập nhật chính thức.</p><p className="mt-6 text-sm">Dự kiến 21 tháng 11, 2026<br />Mở cửa từ 16:00</p></div></div></section>;
}
export function FAQSection() {
  return <section className="site-container section-space faq-section"><div><p className="eyebrow">06 / Trước giờ lên nhạc</p><h2>Thông tin<br />cần biết.</h2></div><div>{faqs.map(([question, answer]) => <details key={question} className="faq-item"><summary>{question}<Plus size={20} aria-hidden="true" /></summary><p>{answer}</p></details>)}</div></section>;
}
