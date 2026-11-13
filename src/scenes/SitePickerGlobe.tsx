/**
 * PLACEHOLDER — owner: Pink. A flat (equirectangular) Moon map with pins so step 1 works today.
 * Replace with the Moon Trek globe; keep SitePickerGlobeProps.
 */
import type { MouseEvent } from 'react';
import type { SitePickerGlobeProps } from './contracts';
import s from './placeholders.module.css';

export function SitePickerGlobe({ sites, selectedIds, onSelectSite, onPickCoords }: SitePickerGlobeProps) {
  const x = (lon: number) => ((lon + 180) / 360) * 100;
  const y = (lat: number) => ((90 - lat) / 180) * 100;

  const pick = (e: MouseEvent<HTMLDivElement>) => {
    if (!onPickCoords || e.target !== e.currentTarget) return;
    const r = e.currentTarget.getBoundingClientRect();
    const lon = ((e.clientX - r.left) / r.width) * 360 - 180;
    const lat = 90 - ((e.clientY - r.top) / r.height) * 180;
    onPickCoords(Math.round(lat * 100) / 100, Math.round(lon * 100) / 100);
  };

  return (
    <div
      className={s.map}
      onClick={pick}
      role="application"
      aria-label="Moon map. Click a pin to select a site, or click anywhere to set custom coordinates."
    >
      <span className={s.meridian} style={{ left: '50%' }} />
      <span className={s.parallel} style={{ top: '50%' }} />
      <span className={s.polarBand} />
      {sites.map((site) => {
        const selected = selectedIds.includes(site.id);
        return (
          <button
            key={site.id}
            type="button"
            className={[s.pin, selected && s.pinSelected].filter(Boolean).join(' ')}
            style={{ left: `${x(site.lon)}%`, top: `${y(site.lat)}%` }}
            onClick={() => onSelectSite(site.id)}
            aria-pressed={selected}
            title={site.name}
          >
            <span className={s.pinDot} />
            <span className={s.pinLabel}>{site.name}</span>
          </button>
        );
      })}
      <span className={s.mapNote}>Placeholder flat map (near side in the middle) · Pink's Moon Trek globe goes here</span>
    </div>
  );
}
