/** A tiny bus so story code can ask the one on-screen Refaey to hop (a lesson learned, a click) without owning it. */
type Listener = () => void;
const listeners = new Set<Listener>();
export const refaeyActor = {
  hop: () => listeners.forEach((l) => l()),
  onHop: (l: Listener) => {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
};
