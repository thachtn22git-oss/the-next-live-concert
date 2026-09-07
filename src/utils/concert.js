import { CONCERT_TIME_ZONE } from '../constants/concert.js';

export function formatConcertTime(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return 'Chưa công bố';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: CONCERT_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(date);
}

export function formatConcertDate(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return 'Ngày diễn sẽ được công bố';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: CONCERT_TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(date);
}

export function safePublicUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
