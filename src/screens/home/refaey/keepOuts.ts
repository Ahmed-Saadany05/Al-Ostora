import type { Rect } from './placement';

const SELECTOR = 'a,button,input,select,textarea,h1,h2,h3,h4,h5,h6,p,label,img,svg,[role],[aria-label],[data-refaey-avoid]';
const TEXT = /^(P|H[1-6]|LABEL)$/;

const rectOf = (r: DOMRect | { left: number; top: number; width: number; height: number }): Rect => ({ x: r.left, y: r.top, w: r.width, h: r.height });

/** The box a text element's words actually fill (not the full width of its container). */
function textRect(el: Element): Rect | null {
  const range = document.createRange();
  range.selectNodeContents(el);
  const r = range.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? rectOf(r) : null;
}

/**
 * Everything Refaey and his balloon must stay clear of, inside `scope`: every visible control, heading, paragraph, label,
 * image or icon, anything with a role or aria-label, and anything marked data-refaey-avoid. Left out: his own stage, hidden
 * things, elements that contain him (page regions), a page's plain-layout fallback (hidden when he is on stage), and
 * anything covering more than half the viewport (a backdrop is not content).
 */
export function collectKeepOuts(scope: Element, stage: Element | null): Rect[] {
  const out: Rect[] = [];
  const vpArea = window.innerWidth * window.innerHeight;
  scope.querySelectorAll(SELECTOR).forEach((el) => {
    if (stage && (stage.contains(el) || el.contains(stage))) return;
    if (el.closest('[aria-hidden="true"]') && !el.hasAttribute('data-refaey-avoid')) return;
    if (el.closest('[data-refaey-fallback]')) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return;
    // a page region that only wraps other things (the main landmark, a list) is not itself content: its children are counted
    if (el.matches('[role="region"],[role="main"],[role="list"],[role="group"],main,section,nav') && !el.hasAttribute('data-refaey-avoid')) return;
    const r = TEXT.test(el.tagName) ? textRect(el) : rectOf(el.getBoundingClientRect());
    if (!r || r.w === 0 || r.h === 0) return;
    if (r.w * r.h > vpArea * 0.5) return;
    out.push(r);
  });
  return out;
}

/** The part of the viewport between the app header and the status bar (the whole viewport when there is no chrome). */
export function safeArea(chrome: boolean): Rect {
  let top = 0;
  let bottom = window.innerHeight;
  if (chrome) {
    const h = document.querySelector('header');
    const f = document.querySelector('footer');
    if (h) top = Math.max(top, h.getBoundingClientRect().bottom);
    if (f) bottom = Math.min(bottom, f.getBoundingClientRect().top);
  }
  return { x: 0, y: top, w: window.innerWidth, h: bottom - top };
}
