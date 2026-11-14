import { Link } from 'react-router-dom';
import { Icon } from '@/shared/ui';
import { isInternal } from './dialogues/sourceCards';
import s from './refaey.module.css';

/** The link on a source card: external pages open in a new tab, internal ones go to /about#…. */
export function SourceLink({ link }: { link: { label: string; href: string } }) {
  return isInternal(link.href) ? (
    <Link className={s.sourceLink} to={link.href}>
      {link.label} <Icon name="arrowRight" size={14} />
    </Link>
  ) : (
    <a className={s.sourceLink} href={link.href} target="_blank" rel="noopener noreferrer">
      {link.label} <Icon name="arrowUpRight" size={14} />
    </a>
  );
}
