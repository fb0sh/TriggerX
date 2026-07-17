import type { Task, AppSettings, TestRunResult, ExecutionLog, RuntimeCheck } from './types';

// ---- Internal Tauri invoke wrapper ----
async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
    return await tauriInvoke<T>(cmd, args);
  } catch {
    throw new Error('Tauri backend not available');
  }
}

// ---- Typed IPC commands ----

export async function getTasks(): Promise<Task[]> {
  return invoke<Task[]>('get_tasks');
}

export async function getSettings(): Promise<AppSettings> {
  return invoke<AppSettings>('get_settings');
}

export async function addTask(task: Task): Promise<void> {
  await invoke('add_task', { task });
}

export async function updateTask(task: Task): Promise<void> {
  await invoke('update_task', { task });
}

export async function deleteTask(id: string): Promise<void> {
  await invoke('delete_task', { id });
}

export async function toggleTask(id: string, enabled: boolean): Promise<void> {
  await invoke('toggle_task', { id, enabled });
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await invoke('save_settings', { settings });
}

export async function runNow(id: string): Promise<void> {
  await invoke('run_now', { id });
}

export async function testRunTask(task: Task): Promise<TestRunResult> {
  return invoke<TestRunResult>('test_run_task', { task });
}

export async function getLogs(taskId: string): Promise<ExecutionLog[]> {
  return invoke<ExecutionLog[]>('get_logs', { taskId });
}

export async function checkRuntimes(): Promise<RuntimeCheck> {
  return invoke<RuntimeCheck>('check_runtimes');
}

export async function getCronTimes(expression: string, count: number): Promise<string[]> {
  return invoke<string[]>('get_cron_times', { expression, count });
}

// ---- Event listener ----

export async function listenTaskCompleted(
  callback: (payload: {
    status: string;
    exitCode: number;
    stdout: string;
    stderr: string;
    executedAt: string;
    durationMs: number;
    error: string | null;
  }) => void,
): Promise<() => void> {
  try {
    const { listen } = await import('@tauri-apps/api/event');
    const unlisten = await listen<any>('task-completed', (e) => callback(e.payload));
    return unlisten;
  } catch {
    return () => {};
  }
}
