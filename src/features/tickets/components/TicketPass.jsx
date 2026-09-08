import { Link } from 'react-router-dom';
import { ArrowUpRight, Minus, Plus } from 'lucide-react';
import { formatVnd, remainingQuantity, saleLabels, saleStatus, selectionLimit, ticketName } from '../utils/tickets';
import { formatConcertDate, formatConcertTime } from '../../../utils/concert';

const colors = ['bg-concert-mint', 'bg-concert-yellow', 'bg-concert-lightBlue'];

export default function TicketPass({ ticket, concert, index = 0, quantity = 0, onQuantityChange, now = Date.now() }) {
  const name = ticketName(ticket);
  const status = saleStatus(ticket, now);
  const limit = selectionLimit(ticket, now);
  const selecting = Boolean(onQuantityChange);
  return <article className={'concert-pass min-w-0 ' + colors[index % colors.length]}>
    <div className="pass-top"><span>THE NEXT / VÉ</span><span>{String(index + 1).padStart(3, '0')}</span></div>
    <h3 className="break-words">{name}</h3><p className="pass-price break-words">{formatVnd(ticket.price)}</p>
    <p className="my-6 min-h-20 whitespace-pre-line break-words text-sm leading-7">{ticket.description || 'Thông tin hạng vé sẽ được cập nhật.'}</p>
    {selecting && <div className="mb-6">
      <p className="text-sm font-semibold">{status === 'available' ? 'Còn ' + remainingQuantity(ticket) + ' vé' : saleLabels[status]}</p>
      <p className="mt-2 text-xs">Tối đa {ticket.max_per_order} vé mỗi lần chọn</p>
      {status === 'upcoming' && <p className="mt-2 text-xs">Mở bán: {formatConcertTime(ticket.sale_start)} · {formatConcertDate(ticket.sale_start)} (giờ Việt Nam)</p>}
      {status === 'available' && ticket.sale_end && <p className="mt-2 text-xs">Kết thúc: {formatConcertTime(ticket.sale_end)} · {formatConcertDate(ticket.sale_end)} (giờ Việt Nam)</p>}
    </div>}
    <div className="pass-bottom flex-wrap gap-3">
      {selecting ? <div className="grid grid-cols-[44px_minmax(44px,auto)_44px] items-center gap-1" role="group" aria-label={'Số lượng vé ' + name}>
        <button className="grid h-11 w-11 place-items-center rounded-full bg-black text-white disabled:cursor-not-allowed disabled:opacity-30" type="button" aria-label={'Giảm số lượng vé ' + name} title={'Giảm số lượng vé ' + name} disabled={quantity === 0 || status !== 'available'} onClick={() => onQuantityChange(ticket.id, quantity - 1)}><Minus size={18} aria-hidden="true" /></button>
        <output className="px-2 text-center text-base tabular-nums" aria-label={'Đã chọn ' + quantity + ' vé ' + name} aria-live="polite">{quantity}</output>
        <button className="grid h-11 w-11 place-items-center rounded-full bg-black text-white disabled:cursor-not-allowed disabled:opacity-30" type="button" aria-label={'Tăng số lượng vé ' + name} title={'Tăng số lượng vé ' + name} disabled={quantity >= limit} onClick={() => onQuantityChange(ticket.id, quantity + 1)}><Plus size={18} aria-hidden="true" /></button>
      </div> : <><span>{concert ? formatConcertDate(concert.starts_at) : 'THE NEXT LIVE CONCERT'}</span><Link to="/tickets" aria-label={'Chọn vé ' + name}><ArrowUpRight size={24} aria-hidden="true" /></Link></>}
      {selecting && quantity > 0 && quantity === limit && <span className="text-xs font-normal">Đã đạt giới hạn</span>}
    </div>
  </article>;
}
