import { formatVnd, ticketName } from '../utils/tickets';

export default function TicketSelectionSummary({ summary, children }) {
  return <section aria-labelledby="ticket-summary-title" className="border-t border-black/20 pt-8">
    <h2 id="ticket-summary-title" className="!text-2xl">Vé đã chọn</h2>
    {!summary.items.length ? <p className="body-copy mt-5">Bạn chưa chọn vé nào.</p> : <ul className="mt-4 divide-y divide-black/15">
      {summary.items.map(({ ticket, quantity, subtotal }) => <li key={ticket.id} className="py-4">
        <p className="break-words font-semibold">{ticketName(ticket)}</p>
        <div className="mt-2 flex flex-wrap justify-between gap-2 text-sm"><span>{quantity} vé × {formatVnd(ticket.price)}</span><span className="font-semibold">{formatVnd(subtotal)}</span></div>
      </li>)}
    </ul>}
    <dl className="mt-6 border-t border-dashed border-black/30 pt-6">
      <div className="flex flex-wrap justify-between gap-3 text-sm"><dt>Tổng số vé</dt><dd>{summary.totalQuantity} vé</dd></div>
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3"><dt className="font-semibold">Tổng cộng</dt><dd className="break-all text-2xl font-bold">{formatVnd(summary.totalAmount)}</dd></div>
    </dl>
    {children}
  </section>;
}
