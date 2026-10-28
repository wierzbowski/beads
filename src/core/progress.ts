import type { ReadingDirection } from './pattern';

export interface CraftState {
  /** Number of done rows; rows 1..progress are done. */
  progress: number;
  direction: ReadingDirection;
}

export const INITIAL_STATE: CraftState = { progress: 0, direction: 'ltr' };

function clamp(progress: number, totalRows: number): number {
  return Math.max(0, Math.min(totalRows, Math.floor(progress)));
}

export function markDone(state: CraftState, totalRows: number): CraftState {
  return { ...state, progress: clamp(state.progress + 1, totalRows) };
}

export function undo(state: CraftState, totalRows: number): CraftState {
  return { ...state, progress: clamp(state.progress - 1, totalRows) };
}

/** Makes `row` the current row. */
export function jumpToRow(state: CraftState, row: number, totalRows: number): CraftState {
  return { ...state, progress: clamp(row - 1, totalRows) };
}

export function reset(state: CraftState): CraftState {
  return { ...state, progress: 0 };
}

export function toggleDirection(state: CraftState): CraftState {
  return { ...state, direction: state.direction === 'ltr' ? 'rtl' : 'ltr' };
}

/** State saved on the device for the same pattern wins over the state carried by the link. */
export function resolveState(fromLink: CraftState, stored: CraftState | null, totalRows: number): CraftState {
  const chosen = stored ?? fromLink;
  return { ...chosen, progress: clamp(chosen.progress, totalRows) };
}

export interface StateStore {
  load(fingerprint: string): CraftState | null;
  save(fingerprint: string, state: CraftState): void;
}

const KEY_PREFIX = 'beads:';

export function localStateStore(storage: Pick<Storage, 'getItem' | 'setItem'>): StateStore {
  return {
    load(fingerprint) {
      try {
        const raw = storage.getItem(KEY_PREFIX + fingerprint);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (
          typeof parsed === 'object' &&
          parsed !== null &&
          'progress' in parsed &&
          'direction' in parsed &&
          typeof parsed.progress === 'number' &&
          (parsed.direction === 'ltr' || parsed.direction === 'rtl')
        ) {
          return { progress: parsed.progress, direction: parsed.direction };
        }
        return null;
      } catch {
        return null;
      }
    },
    save(fingerprint, state) {
      try {
        storage.setItem(KEY_PREFIX + fingerprint, JSON.stringify(state));
      } catch {
        // Storage may be unavailable (private mode, quota); the link still carries the state.
      }
    },
  };
}
