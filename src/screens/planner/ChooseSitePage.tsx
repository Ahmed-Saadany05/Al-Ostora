/**
 * STEP 1 — Choose your site. PLACEHOLDER layout — owner: Aser (page) · Hagras (catalogue + search/tag helpers).
 * Search bar → always-visible custom coordinates → one row of tags → short two-line list.
 * Selection lives in the URL (?sites=a,b).
 */
import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { hasTag, matchesQuery, parseCoords, SITE_TAGS, siteStatus, siteSubtitle, STATUS_META, type SiteTag } from '@/data/sites';
import { SitePickerGlobe } from '@/scenes';
import { formatLatLon } from '@/shared/format';
import { customSite, MAX_COMPARE, missionUrl, useMission } from '@/shared/mission';
import { Button, EmptyState, Icon, LoadingState, OwnerNote, Page, Pill, StepHeader } from '@/shared/ui';
import s from './flow.module.css';

export function ChooseSitePage() {
  const navigate = useNavigate();
  const { catalogue, loading, siteIds, sites } = useMission();
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<SiteTag>('all');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [coordError, setCoordError] = useState<string>();

  const setSelection = (ids: string[]) => navigate(missionUrl.chooseSite(ids), { replace: true });
  const toggle = (id: string) =>
    setSelection(siteIds.includes(id) ? siteIds.filter((x) => x !== id) : siteIds.length < MAX_COMPARE ? [...siteIds, id] : siteIds);
  const addCustom = (la: number, lo: number) => {
    const site = customSite(la, lo);
    if (!siteIds.includes(site.id) && siteIds.length < MAX_COMPARE) setSelection([...siteIds, site.id]);
  };
  const onSubmitCoords = (e: FormEvent) => {
    e.preventDefault();
    const la = Number(lat);
    const lo = Number(lon);
    if (lat.trim() === '' || !Number.isFinite(la) || la < -90 || la > 90) return setCoordError('Latitude must be between −90 and 90.');
    if (lon.trim() === '' || !Number.isFinite(lo) || lo < -180 || lo > 180) return setCoordError('Longitude must be between −180 and 180.');
    setCoordError(undefined);
    addCustom(la, lo);
  };

  const typedCoords = parseCoords(query);
  const results = useMemo(
    () => (catalogue ?? []).filter((x) => hasTag(x, tag) && (typedCoords ? false : matchesQuery(x, query))),
    [catalogue, tag, query, typedCoords],
  );
  const pins = [...results, ...sites.filter((x) => !results.some((r) => r.id === x.id))];

  const next =
    sites.length === 0 ? null : sites.length === 1 ? (
      <Button variant="primary" size="lg" to={missionUrl.stand(sites[0].id)}>
        Stand on this site
      </Button>
    ) : (
      <Button variant="primary" size="lg" to={missionUrl.compare(siteIds)}>
        Compare {sites.length} sites
      </Button>
    );

  return (
    <Page>
      <StepHeader step="site" title="Where will you" accent="land?" back={{ to: '/', label: 'Home' }} />

      <div className={s.chooseGrid}>
        <SitePickerGlobe sites={pins} selectedIds={siteIds} onSelectSite={toggle} onPickCoords={addCustom} />

        <aside className={s.side}>
          {/* 1 · search */}
          <label className={s.search}>
            <Icon name="search" size={18} />
            <input
              type="search"
              placeholder="Search a site, mission, country…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search sites"
            />
          </label>
          {typedCoords && (
            <button type="button" className={s.coordHit} onClick={() => addCustom(typedCoords.lat, typedCoords.lon)}>
              <Icon name="pin" size={16} />
              Land at <span className="num">{formatLatLon(typedCoords.lat, typedCoords.lon)}</span>
              <Icon name="arrowRight" size={14} />
            </button>
          )}

          {/* 2 · custom coordinates — always visible */}
          <form className={s.coords} onSubmit={onSubmitCoords}>
            <div className={s.coordRow}>
              <span className={s.coordLabel}>
                <Icon name="pin" size={14} /> Or land anywhere
              </span>
              <input className={['num', s.input, s.inputSm].join(' ')} placeholder="Lat" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} aria-label="Latitude (−90 to 90)" />
              <input className={['num', s.input, s.inputSm].join(' ')} placeholder="Lon" inputMode="decimal" value={lon} onChange={(e) => setLon(e.target.value)} aria-label="Longitude (−180 to 180)" />
              <Button type="submit" variant="secondary" icon={null} className={s.go}>
                Go
              </Button>
            </div>
            {coordError && <span className={s.error}>{coordError}</span>}
          </form>

          {/* 3 · tags */}
          <div className={s.tags} role="radiogroup" aria-label="Filter sites">
            {SITE_TAGS.map((t) => (
              <button key={t.id} type="button" role="radio" aria-checked={tag === t.id} className={[s.tag, tag === t.id && s.tagOn].filter(Boolean).join(' ')} onClick={() => setTag(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          {/* 4 · list */}
          {loading && <LoadingState compact title="Loading sites…" />}
          {!loading && !typedCoords && (
            <>
              <span className={s.count}>
                <span className="num">{results.length}</span> sites · pick 1 to stand on it, up to {MAX_COMPARE} to compare
              </span>
              {results.length === 0 ? (
                <EmptyState compact icon="search" title="No sites match" message="Try another word or tag, or enter your own coordinates above." />
              ) : (
                <ul className={s.siteList}>
                  {results.map((site) => {
                    const st = STATUS_META[siteStatus(site)];
                    const on = siteIds.includes(site.id);
                    return (
                      <li key={site.id}>
                        <button type="button" className={[s.siteItem, on && s.siteItemOn].filter(Boolean).join(' ')} onClick={() => toggle(site.id)} aria-pressed={on}>
                          <span className={s.check} aria-hidden>
                            {on && <Icon name="check" size={14} />}
                          </span>
                          <span className={s.siteText}>
                            <strong>{site.name}</strong>
                            <span>{siteSubtitle(site)}</span>
                          </span>
                          <Pill tone={st.tone} icon={st.icon} label={st.label} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}

          {sites.length > 0 && (
            <div className={s.selected}>
              {sites.map((x) => (
                <button key={x.id} type="button" className={s.chip} onClick={() => toggle(x.id)} aria-label={`Remove ${x.name}`}>
                  {x.kind === 'custom' ? formatLatLon(x.lat, x.lon, 1) : x.name} <Icon name="close" size={12} />
                </button>
              ))}
            </div>
          )}
          {next}
        </aside>
      </div>
      <OwnerNote owner="Aser (page) · Pink (globe) · Hagras (catalogue)">Step 1 placeholder. The map is a stand-in for the Moon Trek globe.</OwnerNote>
    </Page>
  );
}
