/** PLACEHOLDER — owner: Hady. Shows the hero style; replace freely. */
import { lazy, Suspense } from 'react';
import { Button, DisplayHeading, Lead } from '@/shared/ui';
import s from './HomePage.module.css';

const MoonPlaceholder = lazy(() => import('@/scenes/MoonPlaceholder').then((m) => ({ default: m.MoonPlaceholder })));

export function HomePage() {
  return (
    <section className={s.hero}>
      <div className={s.copy}>
        <DisplayHeading accent="Moon.">
          A little closer
          <br />
          to the
        </DisplayHeading>
        <Lead>
          Every great journey starts with a little curiosity. Explore our celestial neighborhood, find your place on the
          Moon, and choose your moment.
        </Lead>
        <Button variant="primary" size="lg" to="/mission">
          Begin the journey
        </Button>
      </div>
      <div className={s.moon} aria-hidden>
        <Suspense fallback={null}>
          <MoonPlaceholder />
        </Suspense>
      </div>
    </section>
  );
}
