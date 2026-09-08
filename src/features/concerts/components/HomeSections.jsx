import { ArrowUpRight, MapPin, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { faqs } from '../data/home';
import { useTicketSelection } from '../../tickets/hooks/useTicketSelection';
import TicketPass from '../../tickets/components/TicketPass';
import TicketDataState from '../../tickets/components/TicketDataState';
import { useConcert } from '../../../hooks/useConcert';
import ArtistGrid from '../../artists/ArtistGrid';
import ScheduleList from '../../schedule/ScheduleList';
import DataState from '../../../components/DataState';

export function AboutSection() {
  return <section className="site-container section-space about-section"><p className="eyebrow">01 / Về The Next</p><div><h2>Một đêm âm nhạc.<br /><span className="text-muted">Hàng nghìn cảm xúc.</span></h2><p className="body-copy mt-7 max-w-xl">The Next Live Concert là nơi âm nhạc, ánh sáng và những nghệ sĩ bạn yêu thích cùng tạo nên một đêm đáng nhớ. Đến để hòa vào đám đông. Ở lại vì những giai điệu không muốn kết thúc.</p><Link className="text-link mt-7" to="/concert">Câu chuyện của The Next <ArrowUpRight size={18} /></Link></div></section>;
}
export function ArtistSection() {
  const { status, artists, concert, retry } = useConcert();
  const featured = artists.filter(artist => artist.is_featured);
  const preview = (featured.length ? featured : artists).slice(0, 2);
  return <section className="artists-band section-space"><div className="site-container"><div className="section-heading"><div><p className="eyebrow">02 / Dàn nghệ sĩ</p><h2>Những âm sắc.<br />Cùng một nhịp đập.</h2></div><div><p className="body-copy max-w-xs">Những cái tên sẽ xuất hiện tại The Next Live Concert đang dần được hé lộ.</p><Link className="text-link mt-5" to="/artists">Xem nghệ sĩ <ArrowUpRight size={18} /></Link></div></div>
    <DataState status={status} empty={!preview.length} retry={retry} emptyMessage="Danh sách nghệ sĩ sẽ sớm được công bố." />
    {status === 'success' && preview.length > 0 && <ArtistGrid artists={preview} />}
    {concert?.is_sample && <p className="mt-5 text-xs text-muted">Nghệ sĩ hư cấu và hình ảnh minh họa. Danh sách nghệ sĩ chính thức sẽ được công bố sau.</p>}
  </div></section>;
}
export function ScheduleSection() {
  const { status, schedules, retry } = useConcert();
  return <section className="site-container section-space schedule-section"><div><p className="eyebrow">03 / Lịch trình dự kiến</p><h2>Từ nhịp đầu tiên.<br />Đến phút cuối cùng.</h2><Link to="/schedule" className="text-link mt-7">Xem lịch trình <ArrowUpRight size={18} /></Link></div><div className="min-w-0">
    <DataState status={status} empty={!schedules.length} retry={retry} emptyMessage="Lịch trình sự kiện sẽ sớm được công bố." />
    {status === 'success' && schedules.length > 0 && <ScheduleList schedules={schedules.slice(0, 5)} compact />}
  </div></section>;
}
export function TicketSection() {
  const { status, concert, ticketTypes, refresh, now } = useTicketSelection();
  return <section className="ticket-band section-space"><div className="site-container"><div className="section-heading"><div><p className="eyebrow">04 / Hạng vé</p><h2>Chọn trải nghiệm<br />của bạn.</h2></div><p className="body-copy max-w-xs">Mỗi vị trí, một cảm xúc riêng.<br />{concert?.is_sample ? 'Hạng vé mẫu. Chưa mở bán chính thức.' : 'Chọn hạng vé cho đêm nhạc của bạn.'}</p></div>
    <TicketDataState status={status} empty={!ticketTypes.length} retry={refresh} />
    {status === 'success' && ticketTypes.length > 0 && <div className="ticket-grid">{ticketTypes.slice(0, 3).map((ticket, index) => <TicketPass key={ticket.id} ticket={ticket} concert={concert} index={index} now={now} />)}</div>}
    <Link to="/tickets" className="text-link mt-8">Chọn vé <ArrowUpRight size={18} /></Link>
  </div></section>;
}
export function VenueSection() {
  return <section className="venue-band"><div className="site-container section-space venue-inner"><div><p className="eyebrow">05 / Điểm hẹn</p><h2>ĐÀ NẴNG.</h2><p className="venue-subtitle">Thành phố biển.<br />Một đêm thật khác.</p></div><div className="venue-details"><MapPin size={30} strokeWidth={1.5} /><h3>Hẹn bạn tại Đà Nẵng</h3><p>Thông tin địa điểm sẽ được cập nhật chính thức.</p><p className="mt-6 text-sm">Dự kiến 21 tháng 11, 2026<br />Mở cửa từ 16:00</p></div></div></section>;
}
export function FAQSection() {
  return <section className="site-container section-space faq-section"><div><p className="eyebrow">06 / Trước giờ lên nhạc</p><h2>Thông tin<br />cần biết.</h2></div><div>{faqs.map(([question, answer]) => <details key={question} className="faq-item"><summary>{question}<Plus size={20} aria-hidden="true" /></summary><p>{answer}</p></details>)}</div></section>;
}
