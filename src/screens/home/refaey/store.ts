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

import type { Lesson } from './dialogues/dialogues';
import { DEFAULT_CALLSIGN } from './dialogues/dialogues';

interface RefaeyState {
  /** Has the briefing played this session? It plays once. */
  briefed: boolean;
  /** The lander's callsign (the visitor names it in the briefing). */
  callsign: string;
  /** Which real landings Refaey has finished studying this session. */
  lessons: Partial<Record<Lesson, true>>;
  /** The short introduction on a planner screen (for a visitor who skipped the briefing) has been shown. */
  introduced: boolean;
  /** Moments already shown this session, so they never repeat. */
  seen: Record<string, true>;
  markBriefed: () => void;
  setCallsign: (callsign: string) => void;
  learn: (lesson: Lesson) => void;
  markIntroduced: () => void;
  markSeen: (id: string) => void;
}

export const useRefaey = create<RefaeyState>()(
  persist(
    (set) => ({
      briefed: false,
      callsign: DEFAULT_CALLSIGN,
      lessons: {},
      introduced: false,
      seen: {},
      markBriefed: () => set({ briefed: true }),
      setCallsign: (callsign) => set({ callsign }),
      learn: (lesson) => set((s) => ({ lessons: { ...s.lessons, [lesson]: true } })),
      markIntroduced: () => set({ introduced: true }),
      markSeen: (id) => set((s) => ({ seen: { ...s.seen, [id]: true } })),
    }),
    { name: 'refaey-seen', storage: createJSONStorage(storage), partialize: (s) => ({ seen: s.seen, briefed: s.briefed, callsign: s.callsign, lessons: s.lessons, introduced: s.introduced }) },
  ),
);
