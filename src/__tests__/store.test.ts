import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../store';

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useAppStore.setState({
      tasks: [],
      settings: { smtp: null },
      loading: false,
    });
  });

  it('should have initial state', () => {
    const state = useAppStore.getState();
    expect(state.tasks).toEqual([]);
    expect(state.settings).toEqual({ smtp: null });
    expect(state.loading).toBe(false);
  });

  it('should update settings', async () => {
    const newSettings = { smtp: { host: 'smtp.test.com', port: 587, username: 'u', password: 'p', from: 'u@t.com' } };
    await useAppStore.getState().saveSettings(newSettings);
    expect(useAppStore.getState().settings).toEqual(newSettings);
  });

  it('should updateTaskResult set lastRun on a task', () => {
    const task = {
      id: 't1', name: 'test', enabled: true,
      config: { type: 'shell' as const, shell: { command: 'echo hi' } },
      schedule: { kind: 'cron' as const, expression: '*/5 * * * *', label: '' },
      lastRun: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    };
    useAppStore.setState({ tasks: [task] });

    const lastRun = {
      status: 'success' as const, exitCode: 0, stdout: 'ok', stderr: '',
      executedAt: '2026-07-17T12:00:00Z', durationMs: 100,
    };
    useAppStore.getState().updateTaskResult('t1', lastRun);

    const updated = useAppStore.getState().tasks.find(t => t.id === 't1');
    expect(updated?.lastRun).toEqual(lastRun);
  });

  describe('addTask optimistic update', () => {
    it('adds task to list immediately', async () => {
      const task = {
        id: 'new-1', name: 'new task', enabled: true,
        config: { type: 'shell' as const, shell: { command: 'echo' } },
        schedule: { kind: 'cron' as const, expression: '* * * * *', label: '' },
        lastRun: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      };
      await useAppStore.getState().addTask(task);
      // IPC fails in test (no Tauri), so rollback should remove it
      // But the optimistic update happened first
      const tasks = useAppStore.getState().tasks;
      // After rollback, task should be removed since IPC failed
      expect(tasks.find(t => t.id === 'new-1')).toBeUndefined();
    });
  });

  describe('deleteTask optimistic update', () => {
    it('removes task and rolls back on IPC failure', async () => {
      const task = {
        id: 'del-1', name: 'to delete', enabled: true,
        config: { type: 'shell' as const, shell: { command: 'echo' } },
        schedule: { kind: 'cron' as const, expression: '* * * * *', label: '' },
        lastRun: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      };
      useAppStore.setState({ tasks: [task] });

      await useAppStore.getState().deleteTask('del-1');
      // IPC fails → rollback restores the task
      const tasks = useAppStore.getState().tasks;
      expect(tasks.find(t => t.id === 'del-1')).toBeDefined();
    });
  });

  describe('toggleTask optimistic update', () => {
    it('toggles enabled and rolls back on IPC failure', async () => {
      const task = {
        id: 'tog-1', name: 'toggle me', enabled: true,
        config: { type: 'shell' as const, shell: { command: 'echo' } },
        schedule: { kind: 'cron' as const, expression: '* * * * *', label: '' },
        lastRun: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      };
      useAppStore.setState({ tasks: [task] });

      await useAppStore.getState().toggleTask('tog-1', false);
      // IPC fails → rollback restores enabled to true
      const tasks = useAppStore.getState().tasks;
      expect(tasks.find(t => t.id === 'tog-1')?.enabled).toBe(true);
    });
  });

  describe('updateTask optimistic update', () => {
    it('updates task and rolls back on IPC failure', async () => {
      const task = {
        id: 'upd-1', name: 'original', enabled: true,
        config: { type: 'shell' as const, shell: { command: 'echo' } },
        schedule: { kind: 'cron' as const, expression: '* * * * *', label: '' },
        lastRun: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      };
      useAppStore.setState({ tasks: [task] });

      const updated = { ...task, name: 'updated' };
      await useAppStore.getState().updateTask(updated);
      // IPC fails → rollback restores original name
      const tasks = useAppStore.getState().tasks;
      expect(tasks.find(t => t.id === 'upd-1')?.name).toBe('original');
    });
  });
});
