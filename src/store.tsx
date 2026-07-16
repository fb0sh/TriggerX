import { create } from 'zustand';
import type { Task, AppSettings } from './types';

// ---- Tauri invoke ----
async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(cmd, args);
  } catch {
    throw new Error('Tauri backend not available');
  }
}

// ---- Store type ----
interface StoreState {
  tasks: Task[];
  settings: AppSettings;
  loading: boolean;
  error: string | null;

  loadTasks: () => Promise<void>;
  loadSettings: () => Promise<void>;
  addTask: (task: Task) => Promise<void>;
  updateTask: (task: Task) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleTask: (id: string, enabled: boolean) => Promise<void>;
  saveSettings: (settings: AppSettings) => Promise<void>;
}

export const useAppStore = create<StoreState>((set) => ({
  tasks: [],
  settings: { smtp: null },
  loading: false,
  error: null,

  loadTasks: async () => {
    set({ loading: true });
    try {
      const tasks = await tauriInvoke<Task[]>('get_tasks');
      set({ tasks: tasks ?? [], loading: false });
    } catch {
      set({ tasks: [...mockTasks], loading: false });
    }
  },

  loadSettings: async () => {
    try {
      const settings = await tauriInvoke<AppSettings>('get_settings');
      set({ settings });
    } catch {
      // dev mode — use defaults
    }
  },

  addTask: async (task) => {
    set((s) => ({ tasks: [task, ...s.tasks] }));
    try { await tauriInvoke('add_task', { task }); } catch { /* dev */ }
  },

  updateTask: async (task) => {
    set((s) => ({ tasks: s.tasks.map(t => t.id === task.id ? task : t) }));
    try { await tauriInvoke('update_task', { task }); } catch { /* dev */ }
  },

  deleteTask: async (id) => {
    set((s) => ({ tasks: s.tasks.filter(t => t.id !== id) }));
    try { await tauriInvoke('delete_task', { id }); } catch { /* dev */ }
  },

  toggleTask: async (id, enabled) => {
    set((s) => ({ tasks: s.tasks.map(t => t.id === id ? { ...t, enabled } : t) }));
    try { await tauriInvoke('toggle_task', { id }); } catch { /* dev */ }
  },

  saveSettings: async (settings) => {
    set({ settings });
    try { await tauriInvoke('save_settings', { settings }); } catch { /* dev */ }
  },
}));

// ---- Mock data ----
const mockTasks: Task[] = [
  {
    id: '1', name: '备份数据库', enabled: true,
    config: { type: 'shell', shell: { command: 'echo "Backing up database..."; sleep 2; echo "Done (2.3GB)"' } },
    schedule: { kind: 'cron', expression: '0 */6 * * *', label: '每 6 小时' },
    lastRun: { status: 'success', exitCode: 0, stdout: 'Done (2.3GB)', stderr: '', executedAt: new Date(Date.now() - 3600000).toISOString(), durationMs: 45000 },
    createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: '2', name: '健康检查', enabled: true,
    config: { type: 'shell', shell: { command: 'curl -sf https://api.example.com/health && echo OK || echo FAIL' } },
    schedule: { kind: 'cron', expression: '*/5 * * * *', label: '每 5 分钟' },
    lastRun: { status: 'success', exitCode: 0, stdout: 'OK', stderr: '', executedAt: new Date(Date.now() - 120000).toISOString(), durationMs: 320 },
    createdAt: new Date(Date.now() - 604800000).toISOString(), updatedAt: new Date(Date.now() - 120000).toISOString(),
  },
  {
    id: '3', name: '清理日志', enabled: false,
    config: { type: 'shell', shell: { command: 'find /var/log -name "*.log" -mtime +30 -delete' } },
    schedule: { kind: 'cron', expression: '0 3 * * 0', label: '每周日凌晨 3:00' },
    lastRun: { status: 'failure', exitCode: 1, stdout: '', stderr: 'Permission denied', executedAt: new Date(Date.now() - 604800000).toISOString(), durationMs: 150 },
    createdAt: new Date(Date.now() - 1209600000).toISOString(), updatedAt: new Date(Date.now() - 604800000).toISOString(),
  },
  {
    id: '4', name: '生成周报', enabled: true,
    config: { type: 'language', language: { language: 'javascript', code: 'console.log("Weekly report generated");' } },
    schedule: { kind: 'once', executeAt: new Date(Date.now() + 7200000).toISOString() },
    lastRun: null, createdAt: new Date(Date.now() - 300000).toISOString(), updatedAt: new Date(Date.now() - 300000).toISOString(),
  },
];
