// Tauri API mocks for Vitest
export async function invoke<T>(cmd: string, _args?: Record<string, unknown>): Promise<T> {
  if (cmd === 'get_tasks') return [] as T;
  if (cmd === 'get_settings') return { smtp: null } as T;
  if (cmd === 'check_runtimes') return { javascript: true, python: true, rust: false, shell: true } as T;
  throw new Error(`Mock invoke not implemented: ${cmd}`);
}
export async function listen() { return () => {}; }
