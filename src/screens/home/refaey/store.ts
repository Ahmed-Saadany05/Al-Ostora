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
  /** Has the visitor pressed Begin on Home this session? Until then no inline card shows anywhere. */
  begun: boolean;
  /** Has the briefing played this session? It plays once. */
  briefed: boolean;
  /** Moments already shown this session, so they never repeat. */
  seen: Record<string, true>;
  begin: () => void;
  markBriefed: () => void;
  markSeen: (id: string) => void;
}

export const useRefaey = create<RefaeyState>()(
  persist(
    (set) => ({
      begun: false,
      briefed: false,
      seen: {},
      begin: () => set({ begun: true }),
      markBriefed: () => set({ briefed: true }),
      markSeen: (id) => set((s) => ({ seen: { ...s.seen, [id]: true } })),
    }),
    { name: 'refaey-seen', storage: createJSONStorage(storage), partialize: (s) => ({ seen: s.seen, begun: s.begun, briefed: s.briefed }) },
  ),
);
