/**
 * STEP 1 — Choose your site. Owner: Aser (page) · Pink (SitePickerGlobe: Moon + sector/site menu).
 * Selection lives in the URL (?sites=a,b).
 */
import { useNavigate } from 'react-router-dom';
import { SitePickerGlobe } from '@/scenes';
import { formatLatLon } from '@/shared/format';
import { customSite, MAX_COMPARE, missionUrl, useMission } from '@/shared/mission';
import { Button, DisplayHeading, Icon, LoadingState, Page } from '@/shared/ui';
import s from './flow.module.css';

export function ChooseSitePage() {
  const navigate = useNavigate();
  const { catalogue, loading, siteIds, sites } = useMission();

  const setSelection = (ids: string[]) => navigate(missionUrl.chooseSite(ids), { replace: true });
  const toggle = (id: string) =>
    setSelection(siteIds.includes(id) ? siteIds.filter((x) => x !== id) : siteIds.length < MAX_COMPARE ? [...siteIds, id] : siteIds);
  const addCustom = (la: number, lo: number) => {
    const site = customSite(la, lo);
    if (!siteIds.includes(site.id) && siteIds.length < MAX_COMPARE) setSelection([...siteIds, site.id]);
  };

  const pins = [...(catalogue ?? []), ...sites.filter((x) => x.kind === 'custom')];
  const next =
    sites.length === 0 ? null : sites.length === 1 ? (
      <Button variant="primary" size="lg" to={missionUrl.stand(sites[0].id)}>
        Stand on {sites[0].kind === 'custom' ? 'your pin' : sites[0].name}
      </Button>
    ) : (
      <Button variant="primary" size="lg" to={missionUrl.compare(siteIds)}>
        Compare {sites.length} sites
      </Button>
    );

  const footer =
    sites.length > 0 ? (
      <>
        <div className={s.selected}>
          {sites.map((x) => (
            <button key={x.id} type="button" className={s.chip} onClick={() => toggle(x.id)} aria-label={`Remove ${x.name}`}>
              {x.kind === 'custom' ? formatLatLon(x.lat, x.lon, 1) : x.name} <Icon name="close" size={12} />
            </button>
          ))}
        </div>
        {next}
      </>
    ) : null;

  return (
    <Page>
      {loading && !catalogue ? (
        <LoadingState title="Loading sites…" />
      ) : (
        <SitePickerGlobe
          layout="full"
          title={
            <DisplayHeading size="lg" align="left" accent="land?">
              Where will you
            </DisplayHeading>
          }
          footer={footer}
          sites={pins}
          selectedIds={siteIds}
          onSelectSite={toggle}
          onPickCoords={addCustom}
        />
      )}
    </Page>
  );
}
