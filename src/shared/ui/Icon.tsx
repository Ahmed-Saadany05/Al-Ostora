import type { SVGProps } from 'react';

/** Thin-line icon set (1.5px stroke, 24 grid). Add new icons here, not inline in screens. */
const paths = {
  arrowUpRight: <path d="M7 17 17 7M8 7h9v9" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
    </>
  ),
  sunset: (
    <>
      <path d="M7 16a5 5 0 0 1 10 0" />
      <path d="M3 19.5h18M12 3v6M9 6l3 3 3-3" />
    </>
  ),
  earth: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.2 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.2-3.5-8.5s1.1-6.1 3.5-8.5Z" />
    </>
  ),
  antenna: (
    <>
      <path d="M12 12v9M8 21h8" />
      <path d="M8.5 8.5a5 5 0 0 1 7 0M6 6a8.5 8.5 0 0 1 12 0" />
      <circle cx="12" cy="11.5" r="1" />
    </>
  ),
  battery: (
    <>
      <rect x="3" y="7.5" width="16" height="9" rx="2" />
      <path d="M21.5 10.5v3M6.5 10.5v3M9.5 10.5v3" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />,
  // Planet with a ring: the ring's far half passes BEHIND the (opaque) planet, the near half in front.
  // The planet is filled with --icon-fill (the surface it sits on; page black by default).
  orbit: (
    <>
      <g transform="rotate(-45 12 12)">
        <path d="M2 12A10 2 0 0 1 22 12" />
      </g>
      <circle cx="12" cy="12" r="5.5" style={{ fill: 'var(--icon-fill, var(--color-bg))' }} />
      <g transform="rotate(-45 12 12)">
        <path d="M2 12A10 2 0 0 0 22 12" />
        {/* The small moon rides on the ring (placed in the ring's own, untilted frame). */}
        <circle cx="20.18" cy="10.85" r="1.4" fill="currentColor" stroke="none" />
      </g>
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-6.5-6.1-6.5-11a6.5 6.5 0 0 1 13 0c0 4.9-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  play: <path d="M8 5.5v13l10.5-6.5L8 5.5Z" />,
  pause: <path d="M8.5 5.5v13M15.5 5.5v13" />,
  motion: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  soundOff: <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4v-5ZM16 9.5l5 5M21 9.5l-5 5" />,
  soundOn: <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4v-5ZM16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />,
  alert: <path d="M12 4 2.8 19.5h18.4L12 4ZM12 10v4.5M12 17.2v.1" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8v.1" />
    </>
  ),
  layers: <path d="m12 4 9 5-9 5-9-5 9-5ZM3 14l9 5 9-5" />,
  compare: <path d="M9 4v16M15 4v16M4 8h5M15 16h5" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
  beaker: <path d="M9 3.5h6M10 3.5v6L4.5 19a1 1 0 0 0 .9 1.5h13.2a1 1 0 0 0 .9-1.5L14 9.5v-6M7 14.5h10" />,
} as const;

export type IconName = keyof typeof paths;

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
  /** Accessible label. Omit when the icon sits next to visible text (decorative). */
  title?: string;
}

export function Icon({ name, size = 18, title, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
