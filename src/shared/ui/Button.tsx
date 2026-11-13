import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from './Icon';
import s from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'md' | 'lg';

interface CommonProps {
  /** primary = the ONE main action per screen. secondary = everything else. ghost = low emphasis. */
  variant?: Variant;
  size?: Size;
  /** Trailing icon. Primary defaults to ↗. Pass null for none. */
  icon?: IconName | null;
  leadingIcon?: IconName;
  children: ReactNode;
  className?: string;
}

type AsButton = CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & { to?: never; href?: never };
type AsRoute = CommonProps & { to: string; href?: never; onClick?: () => void };
type AsExternal = CommonProps & { href: string; to?: never; onClick?: () => void };

export type ButtonProps = AsButton | AsRoute | AsExternal;

export function Button(props: ButtonProps) {
  const { variant = 'secondary', size = 'md', icon, leadingIcon, children, className, ...rest } = props;
  const trailing = icon === undefined ? (variant === 'primary' ? 'arrowUpRight' : null) : icon;
  const cls = [s.button, s[variant], s[size], className].filter(Boolean).join(' ');
  const body = (
    <>
      {leadingIcon && <Icon name={leadingIcon} size={size === 'lg' ? 18 : 16} />}
      <span>{children}</span>
      {trailing && <Icon name={trailing} size={size === 'lg' ? 18 : 16} className={s.trailing} />}
    </>
  );

  if ('to' in rest && rest.to) {
    const { to, onClick } = rest as AsRoute;
    return (
      <Link to={to} className={cls} onClick={onClick}>
        {body}
      </Link>
    );
  }
  if ('href' in rest && rest.href) {
    const { href, onClick } = rest as AsExternal;
    return (
      <a href={href} className={cls} target="_blank" rel="noreferrer" onClick={onClick}>
        {body}
      </a>
    );
  }
  const { type = 'button', ...buttonRest } = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button type={type} className={cls} {...buttonRest}>
      {body}
    </button>
  );
}

/** Square icon-only button (toolbars, close, play). Always needs a label. */
export function IconButton({
  icon,
  label,
  active,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={[s.iconButton, active && s.active, className].filter(Boolean).join(' ')}
      {...rest}
    >
      <Icon name={icon} size={18} />
    </button>
  );
}
