/** A tiny bus so story code can ask the one on-screen Refaey to hop (a lesson learned, a click) without owning it, and so pages can show what he says when poked. */
type Listener = () => void;
type QuipListener = (line: string | null) => void;
const listeners = new Set<Listener>();
const quipListeners = new Set<QuipListener>();
export const refaeyActor = {
  hop: () => listeners.forEach((l) => l()),
  onHop: (l: Listener) => {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
  /** What he says when poked, for two seconds (null when it is over). Pages show it in his text area. */
  say: (line: string | null) => quipListeners.forEach((l) => l(line)),
  onSay: (l: QuipListener) => {
    quipListeners.add(l);
    return () => void quipListeners.delete(l);
  },
};
