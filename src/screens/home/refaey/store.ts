import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

/** sessionStorage when it works (private mode can throw); otherwise a plain in-memory object. */
const memory = new Map<string, string>();
const fallback: StateStorage = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => void memory.set(k, v),
  removeItem: (k) => void memory.delete(k),
};
const storage = (): StateStorage => {
  try {
    const probe = '__refaey_probe__';
    window.sessionStorage.setItem(probe, '1');
    window.sessionStorage.removeItem(probe);
    return window.sessionStorage;
  } catch {
    return fallback;
  }
};

interface RefaeyState {
  /** Is a bubble or the Ask menu showing (false = only the small portrait)? */
  open: boolean;
  mode: 'node' | 'ask';
  nodeId: string | null;
  /** Nodes visited in this conversation, so "Back" can return from an explainer. */
  trail: string[];
  /** Half-body on the scene (the intro), or the small bust in the corner (everything after)? */
  presence: 'stage' | 'dock';
  /** Begin was pressed and the Moon flight is under way: the intro opens when the post-flight view is on screen. Not persisted. */
  introPending: boolean;
  /** Has the visitor pressed Begin on Home this session? Until then Refaey is not shown anywhere. Persisted. */
  begun: boolean;
  /** Moments already shown this session, so they never repeat. Persisted to sessionStorage. */
  seen: Record<string, true>;
  /** Begin on Home: from now on he is available on other screens; nothing opens yet (the hero stays clean). */
  begin: () => void;
  /** The post-flight view is up: his half-body rises and the intro starts. */
  startIntro: (id: string) => void;
  openNode: (id: string) => void;
  openAsk: () => void;
  goto: (id: string) => void;
  back: () => void;
  collapse: () => void;
  markSeen: (id: string) => void;
}

export const useRefaey = create<RefaeyState>()(
  persist(
    (set) => ({
      open: false,
      mode: 'node',
      nodeId: null,
      trail: [],
      presence: 'dock',
      introPending: false,
      begun: false,
      seen: {},
      begin: () => set({ begun: true, introPending: true }),
      startIntro: (id) => set({ introPending: false, presence: 'stage', open: true, mode: 'node', nodeId: id, trail: [] }),
      openNode: (id) => set({ open: true, presence: 'dock', mode: 'node', nodeId: id, trail: [] }),
      openAsk: () => set({ open: true, presence: 'dock', mode: 'ask', nodeId: null, trail: [] }),
      goto: (id) => set((s) => ({ open: true, mode: 'node', nodeId: id, trail: s.nodeId ? [...s.trail, s.nodeId] : s.trail })),
      back: () =>
        set((s) => {
          const trail = [...s.trail];
          const prev = trail.pop();
          return prev ? { nodeId: prev, trail } : {};
        }),
      collapse: () => set({ open: false, presence: 'dock', mode: 'node', nodeId: null, trail: [] }),
      markSeen: (id) => set((s) => ({ seen: { ...s.seen, [id]: true } })),
    }),
    { name: 'refaey-seen', storage: createJSONStorage(storage), partialize: (s) => ({ seen: s.seen, begun: s.begun }) },
  ),
);
