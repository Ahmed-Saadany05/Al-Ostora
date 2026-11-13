import { useEffect } from 'react';
import { NavLink, Outlet, useMatches } from 'react-router-dom';
import { getProvider } from '@/shared/data';
import { useApp } from '@/shared/store/app';
import { TimeTicker } from '@/shared/store/time';
import { Divider, Icon, Starfield } from '@/shared/ui';
import type { RouteHandle } from './routeTypes';
import s from './AppShell.module.css';

/** Keep the bar short — everything else happens inside the mission flow. */
const NAV = [
  { to: '/', label: 'Explore', end: true },
  { to: '/mission', label: 'Plan a mission' },
];

export function AppShell() {
  const motion = useApp((st) => st.motion);
  const setMotion = useApp((st) => st.setMotion);
  const sound = useApp((st) => st.sound);
  const setSound = useApp((st) => st.setSound);
  const matches = useMatches();
  const handle = [...matches].reverse().find((m) => (m.handle as RouteHandle | undefined)?.caption)?.handle as
    | RouteHandle
    | undefined;
  const provider = getProvider();

  useEffect(() => {
    document.documentElement.dataset.motion = motion ? 'on' : 'off';
  }, [motion]);

  useEffect(() => {
    document.title = handle?.title ? `${handle.title} · Refaey on the Moon` : 'Refaey on the Moon';
  }, [handle?.title]);

  return (
    <div className={s.shell}>
      <Starfield />
      <TimeTicker />
      <a href="#main" className={s.skip}>
        Skip to content
      </a>

      <header className={s.header}>
        <NavLink to="/" className={s.brand} aria-label="Refaey on the Moon — home">
          <span className={s.logo}>
            <Icon name="orbit" size={30} />
          </span>
          <span className={s.wordmark}>
            <span className={s.name}>refaey</span>
            <span className={s.tagline}>On the Moon</span>
          </span>
        </NavLink>

        <nav className={s.nav} aria-label="Main">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => [s.navLink, isActive && s.active].filter(Boolean).join(' ')}>
              {n.label}
            </NavLink>
          ))}
          <NavLink to="/about" className={({ isActive }) => [s.navLink, isActive && s.active].filter(Boolean).join(' ')}>
            The project <Icon name="arrowUpRight" size={13} />
          </NavLink>
        </nav>

        <div className={s.headerEnd} />
      </header>

      <main id="main" className={s.main}>
        <Outlet />
      </main>

      <footer className={s.status}>
        <div className={s.statusGroup}>
          <Icon name="plus" size={16} className={s.plus} />
          <span>{handle?.caption ?? 'Refaey on the Moon'}</span>
          <Divider vertical />
          <span className={provider.id === 'demo' ? s.demo : s.live} title={provider.id === 'demo' ? 'Numbers are placeholders' : 'Numbers from JPL Horizons + NASA LOLA'}>
            <Icon name={provider.id === 'demo' ? 'beaker' : 'orbit'} size={13} />
            {provider.id === 'demo' ? 'Demo data' : 'Live NASA data'}
          </span>
        </div>
        <div className={s.statusGroup}>
          <button type="button" className={s.toggle} onClick={() => setMotion(!motion)} aria-pressed={motion}>
            <Icon name="motion" size={15} /> Motion {motion ? 'on' : 'off'}
          </button>
          <Divider vertical />
          <button type="button" className={s.toggle} onClick={() => setSound(!sound)} aria-pressed={sound} aria-label={sound ? 'Sound on' : 'Sound off'}>
            <Icon name={sound ? 'soundOn' : 'soundOff'} size={15} />
          </button>
          <span className={s.credit}>Al Ostora / Space Apps</span>
        </div>
      </footer>
    </div>
  );
}
