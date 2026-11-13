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
  /** Moments already shown this session, so they never repeat. Persisted to sessionStorage. */
  seen: Record<string, true>;
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
      seen: {},
      openNode: (id) => set({ open: true, mode: 'node', nodeId: id, trail: [] }),
      openAsk: () => set({ open: true, mode: 'ask', nodeId: null, trail: [] }),
      goto: (id) => set((s) => ({ open: true, mode: 'node', nodeId: id, trail: s.nodeId ? [...s.trail, s.nodeId] : s.trail })),
      back: () =>
        set((s) => {
          const trail = [...s.trail];
          const prev = trail.pop();
          return prev ? { nodeId: prev, trail } : {};
        }),
      collapse: () => set({ open: false, mode: 'node', nodeId: null, trail: [] }),
      markSeen: (id) => set((s) => ({ seen: { ...s.seen, [id]: true } })),
    }),
    { name: 'refaey-seen', storage: createJSONStorage(storage), partialize: (s) => ({ seen: s.seen }) },
  ),
);
