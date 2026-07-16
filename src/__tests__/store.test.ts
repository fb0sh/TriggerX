import { describe, it, expect } from 'vitest';
import { useAppStore } from '../store';

describe('useAppStore', () => {
  it('should have initial state', () => {
    const state = useAppStore.getState();
    expect(state.tasks).toEqual([]);
    expect(state.settings).toEqual({ smtp: null });
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('should update settings', async () => {
    const newSettings = { smtp: { host: 'smtp.test.com', port: 587, username: 'u', password: 'p', from: 'u@t.com' } };
    await useAppStore.getState().saveSettings(newSettings);
    expect(useAppStore.getState().settings).toEqual(newSettings);
  });
});
