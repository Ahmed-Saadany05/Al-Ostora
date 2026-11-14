/** Past missions: Refaey asks you to pick a landing; each card takes you to stand on that site at touchdown. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDeg } from '@/shared/format';
import { missionUrl } from '@/shared/mission';
import { Button, Icon } from '@/shared/ui';
import { landingOf, PAST_MISSIONS, previewUrl } from './missions';
import { MISSION_PHOTOS } from './photos';
import { RefaeyTalk } from './RefaeyTalk';
import s from './journey.module.css';

const HUB_TALK = {
  key: 'hub',
  lines: ['Every crew here picked a place and a moment. Pick one, and I’ll stand you there at the minute it touched down.'],
  replies: [],
};

/** The mission's photograph (with its credit); the 3D-model preview if there is none or it fails to load. */
function CardArt({ mission }: { mission: (typeof PAST_MISSIONS)[number] }) {
  const photo = MISSION_PHOTOS[mission.id];
  const [failed, setFailed] = useState(false);
  if (!photo || failed) {
    return (
      <span className={s.cardArt}>
        <img src={previewUrl(mission.cover)} alt="" loading="lazy" draggable={false} />
      </span>
    );
  }
  return (
    <span className={[s.cardArt, s.cardPhoto].join(' ')}>
      <img src={photo.src} width={photo.width} height={photo.height} alt={photo.alt} loading="lazy" draggable={false} onError={() => setFailed(true)} />
      <span className={s.photoCredit}>{photo.credit}</span>
    </span>
  );
}

export function MissionsHub() {
  return (
    <section className={s.hub}>
      <header className={s.hubHead}>
        <div>
          <p className={s.eyebrow}>Past missions</p>
          <h1 className={s.hubTitle}>Where they landed, and when</h1>
          <p className={s.hubLead}>The Sun for power, Earth for radio: see how each landing’s place and time decided both.</p>
        </div>
        <RefaeyTalk placement="inline" content={HUB_TALK} onReply={() => undefined} height="170px" pose="float" entrance="drift" balloonWidth={320} />
      </header>

      <ul className={s.grid}>
        {PAST_MISSIONS.map((m) => {
          const l = landingOf(m);
          return (
            <li key={m.id}>
              <Link to={`/missions/${m.id}`} className={s.card}>
                <CardArt mission={m} />
                <span className={s.cardBody}>
                  <span className={s.cardMeta}>
                    {m.agency} · {m.year}
                    {m.outcome === 'partial' && <span className={s.partial}>tipped over</span>}
                  </span>
                  <span className={s.cardName}>{m.name}</span>
                  <span className={s.cardLine}>{m.tagline}</span>
                  <span className={s.cardSky}>
                    <span>
                      <Icon name="sun" size={13} /> {formatDeg(l.sun.elDeg, 1)}
                    </span>
                    <span>
                      <Icon name="earth" size={13} /> {formatDeg(l.earth.elDeg, 1)}
                    </span>
                    <span className={s.cardSkyNote}>at touchdown</span>
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <footer className={s.hubFoot}>
        <p>Ready to choose your own place and time?</p>
        <Button variant="primary" size="md" icon="arrowRight" to={missionUrl.chooseSite()}>
          Plan a future mission
        </Button>
      </footer>
    </section>
  );
}
