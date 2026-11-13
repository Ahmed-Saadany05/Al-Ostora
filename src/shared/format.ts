/** Display formatting. Data stays in UTC + raw units; format only at the edge. */
import type { IsoTime } from './types';

export const CAIRO_TZ = 'Africa/Cairo';

export function formatNumber(value: number, digits = 1) {
  return value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** "+1.88°" — signed, because negative = below the horizon. */
export function formatDeg(value: number, digits = 2, signed = true) {
  const s = formatNumber(Math.abs(value), digits);
  return `${signed ? (value < 0 ? '−' : '+') : value < 0 ? '−' : ''}${s}°`;
}

export function formatPercent(fraction: number, digits = 0) {
  return `${formatNumber(fraction * 100, digits)}%`;
}

/** Hours → "3d 04h", "5h 12m", "18m". */
export function formatDuration(hours: number) {
  const totalMin = Math.max(0, Math.round(hours * 60));
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (d > 0) return `${d}d ${pad(h)}h`;
  if (h > 0) return `${h}h ${pad(m)}m`;
  return `${m}m`;
}

export function hoursBetween(from: IsoTime, to: IsoTime) {
  return (Date.parse(to) - Date.parse(from)) / 3_600_000;
}

/** "13 Nov 2026, 14:00 UTC" */
export function formatUtc(time: IsoTime, withTime = true) {
  const d = new Date(time);
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  if (!withTime) return date;
  const t = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  return `${date}, ${t} UTC`;
}

/** Same instant in Cairo local time — for the local audience. */
export function formatCairo(time: IsoTime) {
  return new Date(time).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: CAIRO_TZ,
  });
}

/** "89.67° S, 129.78° E" */
export function formatLatLon(lat: number, lon: number, digits = 2) {
  const ns = lat < 0 ? 'S' : 'N';
  const ew = lon < 0 ? 'W' : 'E';
  return `${formatNumber(Math.abs(lat), digits)}° ${ns}, ${formatNumber(Math.abs(lon), digits)}° ${ew}`;
}

/** Azimuth → compass word, e.g. 230° → "SW". */
export function compass(azDeg: number) {
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return names[Math.round((((azDeg % 360) + 360) % 360) / 45) % 8];
}
