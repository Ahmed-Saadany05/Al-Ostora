/**
 * APP-WIDE PREFERENCES — assumptions and toggles.
 * Selected sites / dates live in the URL (see @/shared/mission), not here.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_PARAMS, type Params } from '../types';

const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

interface AppState {
  params: Params;
  motion: boolean;
  sound: boolean;
  setParams: (p: Partial<Params>) => void;
  setMotion: (on: boolean) => void;
  setSound: (on: boolean) => void;
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      params: DEFAULT_PARAMS,
      motion: !prefersReducedMotion,
      sound: false,
      setParams: (p) => set({ params: { ...get().params, ...p } }),
      setMotion: (motion) => set({ motion }),
      setSound: (sound) => set({ sound }),
    }),
    { name: 'refaey-app', version: 2 },
  ),
);
