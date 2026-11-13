/** STEP 1 — Choose your site. PLACEHOLDER — owner: Aser. Selection lives in the URL (?sites=a,b). */
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { SitePickerGlobe } from '@/scenes';
import { formatLatLon } from '@/shared/format';
import { customSite, MAX_COMPARE, missionUrl, useMission } from '@/shared/mission';
import { Button, Card, Icon, LoadingState, OwnerNote, Page, Pill, StepHeader } from '@/shared/ui';
import s from './flow.module.css';

export function ChooseSitePage() {
  const navigate = useNavigate();
  const { catalogue, loading, siteIds, sites } = useMission();
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
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const la = Number(lat);
    const lo = Number(lon);
    if (!Number.isFinite(la) || la < -90 || la > 90) return setCoordError('Latitude must be between −90 and 90.');
    if (!Number.isFinite(lo) || lo < -180 || lo > 180) return setCoordError('Longitude must be between −180 and 180.');
    setCoordError(undefined);
    addCustom(la, lo);
  };

  const pins = [...(catalogue ?? []), ...sites.filter((x) => x.kind === 'custom')];
  const next =
    sites.length === 0 ? null : sites.length === 1 ? (
      <Button variant="primary" size="lg" to={missionUrl.stand(sites[0].id)}>
        Stand on {sites[0].name}
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
          <p className={s.muted}>Pick one site to stand on it, or up to {MAX_COMPARE} to compare.</p>
          {loading && <LoadingState compact title="Loading sites…" />}
          <div className={s.siteList}>
            {catalogue?.map((site) => (
              <Card key={site.id} padding="sm" onSelect={() => toggle(site.id)} selected={siteIds.includes(site.id)}>
                <div className={s.siteRow}>
                  <span className={s.check} aria-hidden>
                    {siteIds.includes(site.id) && <Icon name="check" size={14} />}
                  </span>
                  <span className={s.siteText}>
                    <strong>{site.name}</strong>
                    <span className="num">{formatLatLon(site.lat, site.lon)}</span>
                  </span>
                  {site.kind === 'artemis-candidate' && <Pill icon="pin" label="Artemis" />}
                </div>
              </Card>
            ))}
          </div>

          <form className={s.coords} onSubmit={onSubmit}>
            <span className={s.label}>Or enter coordinates</span>
            <div className={s.coordRow}>
              <input className={['num', s.input].join(' ')} placeholder="Lat −89.45" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} aria-label="Latitude" />
              <input className={['num', s.input].join(' ')} placeholder="Lon −137.3" inputMode="decimal" value={lon} onChange={(e) => setLon(e.target.value)} aria-label="Longitude" />
              <Button type="submit" variant="secondary" leadingIcon="plus" icon={null}>
                Add
              </Button>
            </div>
            {coordError && <span className={s.error}>{coordError}</span>}
            <span className={s.hint}>Tip: click anywhere on the map to drop a pin.</span>
          </form>

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
      <OwnerNote owner="Aser (page) · Pink (globe)">Step 1 placeholder. The map is a stand-in for the Moon Trek globe.</OwnerNote>
    </Page>
  );
}
