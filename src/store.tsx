import { create } from 'zustand';
import type { Task, AppSettings, RunResult } from './types';
import * as ipc from './ipc';

// ---- Store type ----
interface StoreState {
  tasks: Task[];
  settings: AppSettings;
  loading: boolean;

  loadTasks: () => Promise<void>;
  loadSettings: () => Promise<void>;
  addTask: (task: Task) => Promise<void>;
  updateTask: (task: Task) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleTask: (id: string, enabled: boolean) => Promise<void>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  /** Sync a task's lastRun after backend has persisted it. No IPC needed. */
  updateTaskResult: (id: string, lastRun: RunResult) => void;
}

export const useAppStore = create<StoreState>((set) => ({
  tasks: [],
  settings: { smtp: null },
  loading: false,

  loadTasks: async () => {
    set({ loading: true });
    try {
      const tasks = await ipc.getTasks();
      set({ tasks: tasks ?? [], loading: false });
    } catch {
      set({ tasks: [], loading: false });
    }
  },

  loadSettings: async () => {
    try {
      const settings = await ipc.getSettings();
      set({ settings });
    } catch {
      // dev mode — use defaults
    }
  },

  addTask: async (task) => {
    set((s) => ({ tasks: [task, ...s.tasks] }));
    try {
      await ipc.addTask(task);
    } catch {
      // Rollback optimistic update
      set((s) => ({ tasks: s.tasks.filter(t => t.id !== task.id) }));
    }
  },

  updateTask: async (task) => {
    let prev: Task | undefined;
    set((s) => {
      prev = s.tasks.find(t => t.id === task.id);
      return { tasks: s.tasks.map(t => t.id === task.id ? task : t) };
    });
    try {
      await ipc.updateTask(task);
    } catch {
      // Rollback
      if (prev) set((s) => ({ tasks: s.tasks.map(t => t.id === task.id ? prev! : t) }));
    }
  },

  deleteTask: async (id) => {
    let prev: Task[] = [];
    set((s) => {
      prev = s.tasks;
      return { tasks: s.tasks.filter(t => t.id !== id) };
    });
    try {
      await ipc.deleteTask(id);
    } catch {
      // Rollback
      set({ tasks: prev });
    }
  },

  toggleTask: async (id, enabled) => {
    let prevEnabled: boolean | undefined;
    set((s) => {
      const task = s.tasks.find(t => t.id === id);
      prevEnabled = task?.enabled;
      return { tasks: s.tasks.map(t => t.id === id ? { ...t, enabled } : t) };
    });
    try {
      await ipc.toggleTask(id, enabled);
    } catch {
      // Rollback
      if (prevEnabled !== undefined) {
        set((s) => ({ tasks: s.tasks.map(t => t.id === id ? { ...t, enabled: prevEnabled! } : t) }));
      }
    }
  },

  saveSettings: async (settings) => {
    set({ settings });
    try {
      await ipc.saveSettings(settings);
    } catch {
      // Settings save failure is non-critical in dev mode
    }
  },

  updateTaskResult: (id, lastRun) => {
    set((s) => ({
      tasks: s.tasks.map(t => t.id === id ? { ...t, lastRun } : t),
    }));
  },
}));
