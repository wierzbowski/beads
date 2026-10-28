import { describe, expect, it } from 'vitest';
import {
  type CraftState,
  INITIAL_STATE,
  jumpToRow,
  localStateStore,
  markDone,
  reset,
  resolveState,
  toggleDirection,
  undo,
} from './progress';

const TOTAL = 10;
const at = (progress: number): CraftState => ({ progress, direction: 'ltr' });

describe('progress rules', () => {
  it('marks rows done up to the total', () => {
    expect(markDone(at(0), TOTAL).progress).toBe(1);
    expect(markDone(at(10), TOTAL).progress).toBe(10);
  });

  it('undoes down to zero', () => {
    expect(undo(at(5), TOTAL).progress).toBe(4);
    expect(undo(at(0), TOTAL).progress).toBe(0);
  });

  it('jumps so the chosen row becomes current', () => {
    expect(jumpToRow(at(2), 7, TOTAL).progress).toBe(6);
    expect(jumpToRow(at(2), 1, TOTAL).progress).toBe(0);
    expect(jumpToRow(at(2), 99, TOTAL).progress).toBe(10);
  });

  it('resets progress but keeps direction', () => {
    expect(reset({ progress: 5, direction: 'rtl' })).toEqual({ progress: 0, direction: 'rtl' });
  });

  it('toggles direction', () => {
    expect(toggleDirection(at(3))).toEqual({ progress: 3, direction: 'rtl' });
    expect(toggleDirection(toggleDirection(at(3)))).toEqual(at(3));
  });
});

describe('resolveState', () => {
  it('prefers device state for the same pattern', () => {
    expect(resolveState(at(0), { progress: 12, direction: 'rtl' }, 67)).toEqual({ progress: 12, direction: 'rtl' });
  });

  it('falls back to link state', () => {
    expect(resolveState(at(4), null, 67)).toEqual(at(4));
  });

  it('clamps to the pattern height', () => {
    expect(resolveState(at(0), at(80), 67).progress).toBe(67);
  });
});

describe('localStateStore', () => {
  const memoryStorage = () => {
    const data = new Map<string, string>();
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    };
  };

  it('saves and loads per fingerprint', () => {
    const store = localStateStore(memoryStorage());
    store.save('aaa', { progress: 3, direction: 'rtl' });
    expect(store.load('aaa')).toEqual({ progress: 3, direction: 'rtl' });
    expect(store.load('bbb')).toBeNull();
  });

  it('ignores corrupted entries', () => {
    const storage = memoryStorage();
    storage.setItem('beads:aaa', '{oops');
    storage.setItem('beads:bbb', JSON.stringify({ progress: 'x', direction: 'ltr' }));
    const store = localStateStore(storage);
    expect(store.load('aaa')).toBeNull();
    expect(store.load('bbb')).toBeNull();
  });

  it('survives storage that throws', () => {
    const store = localStateStore({
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    });
    expect(store.load('aaa')).toBeNull();
    expect(() => store.save('aaa', INITIAL_STATE)).not.toThrow();
  });
});
