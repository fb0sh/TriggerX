/* =========================================================================
 * Tauri API Mocks — TriggerX 展示页专用
 * ========================================================================= */

import type { Task } from "../src/types";

/* ─── Mock data ──────────────────────────────────────────────────────── */

const mockTasks: Task[] = [
  {
    id: '1', name: '备份数据库', enabled: true,
    config: { type: 'shell', shell: { command: 'pg_dump -h localhost -d production | gzip > /tmp/backup.sql.gz' } },
    schedule: { kind: 'cron', expression: '0 */6 * * *', label: '每 6 小时' },
    lastRun: { status: 'success', exitCode: 0, stdout: 'Backup complete (2.3GB)', stderr: '', executedAt: new Date(Date.now() - 3600000).toISOString(), durationMs: 45000 },
    runCount: 128, createdAt: new Date(Date.now() - 86400000 * 30).toISOString(), updatedAt: new Date(Date.now() - 3600000).toISOString(),
    notify: { system: true, email: true, emailTo: 'admin@example.com', emailTemplate: `Subject: [TriggerX]({{task.status}}) {{task.name}} - 第{{task.runCount}}次执行\n\n任务: {{task.name}}\n状态: {{task.status}}\n退出码: {{task.exitCode}}\n耗时: {{task.duration}}ms\n执行次数: {{task.runCount}}\n执行时间: {{task.executedAt}}` },
  },
  {
    id: '2', name: '健康检查', enabled: true,
    config: { type: 'shell', shell: { command: 'curl -sf https://api.example.com/health && echo OK || echo FAIL' } },
    schedule: { kind: 'cron', expression: '*/5 * * * *', label: '每 5 分钟' },
    lastRun: { status: 'success', exitCode: 0, stdout: 'OK', stderr: '', executedAt: new Date(Date.now() - 120000).toISOString(), durationMs: 320 },
    runCount: 892, createdAt: new Date(Date.now() - 86400000 * 60).toISOString(), updatedAt: new Date(Date.now() - 120000).toISOString(),
    notify: { system: true, systemOnFailureOnly: true },
  },
  {
    id: '3', name: '清理日志', enabled: false,
    config: { type: 'shell', shell: { command: 'find /var/log -name "*.log" -mtime +30 -delete' } },
    schedule: { kind: 'cron', expression: '0 3 * * 0', label: '每周日凌晨 3:00' },
    lastRun: { status: 'failure', exitCode: 1, stdout: '', stderr: 'Permission denied', executedAt: new Date(Date.now() - 604800000).toISOString(), durationMs: 150 },
    runCount: 15, createdAt: new Date(Date.now() - 86400000 * 90).toISOString(), updatedAt: new Date(Date.now() - 604800000).toISOString(),
    notify: { system: true, systemOnFailureOnly: true },
  },
  {
    id: '4', name: '生成周报', enabled: true,
    config: { type: 'language', language: { language: 'javascript', code: 'const data = await fetch("https://api.example.com/stats");\nconsole.log(await data.json());' } },
    schedule: { kind: 'once', executeAt: new Date(Date.now() + 7200000).toISOString() },
    lastRun: null, runCount: 0, createdAt: new Date(Date.now() - 300000).toISOString(), updatedAt: new Date(Date.now() - 300000).toISOString(),
    notify: { email: true, emailTo: 'me@example.com' },
  },
  {
    id: '5', name: '部署前端', enabled: true,
    config: { type: 'command', command: { base: 'rsync', params: [{ flag: '-avz', value: '' }, { flag: '--delete', value: '' }, { flag: './dist/', value: '' }, { flag: 'user@server:/var/www/', value: '' }] } },
    schedule: { kind: 'cron', expression: '0 0 * * *', label: '每天凌晨' },
    lastRun: { status: 'success', exitCode: 0, stdout: 'sent 1234 bytes  received 35 bytes  2538.00 bytes/sec\ntotal size is 567890  speedup is 1.00', stderr: '', executedAt: new Date(Date.now() - 86400000).toISOString(), durationMs: 12000 },
    runCount: 45, createdAt: new Date(Date.now() - 86400000 * 45).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString(),
    notify: { system: true, email: true, emailTo: 'dev@example.com' },
  },
];

const mockSettings = { smtp: { host: 'smtp.example.com', port: 587, username: 'user@example.com', password: '******', from: 'triggerx@example.com' } };

let executionLogs: Record<string, any[]> = {};
let nextLogId = 100;

function addLog(taskId: string, status: string, exitCode: number, stdout: string, stderr: string, trigger: string, runCount: number = 0) {
  if (!executionLogs[taskId]) executionLogs[taskId] = [];
  executionLogs[taskId].unshift({
    id: nextLogId++, taskId, status, exitCode, stdout, stderr,
    executedAt: new Date().toISOString(),
    durationMs: Math.floor(Math.random() * 50000) + 100,
    error: status === 'failure' ? 'Exit code non-zero' : null,
    trigger,
    runCount,
  });
}

/* ─── Progress simulation ────────────────────────────────────────────── */

let runningTasks = new Set<string>();
setInterval(() => {
  // Simulate "Run Now" tasks completing
  for (const id of runningTasks) {
    runningTasks.delete(id);
    const task = mockTasks.find(t => t.id === id);
    if (task) {
      task.lastRun = {
        status: 'success', exitCode: 0,
        stdout: `${task.name} completed successfully`,
        stderr: '', executedAt: new Date().toISOString(), durationMs: Math.floor(Math.random() * 10000) + 500,
      };
      task.runCount = (task.runCount || 0) + 1;
      addLog(id, 'success', 0, `Output from ${task.name}`, '', 'manual', task.runCount);
    }
  }
}, 2000);

/* ─── Mock invoke ────────────────────────────────────────────────────── */

async function invoke(command: string, args?: Record<string, any>): Promise<any> {
  await new Promise(r => setTimeout(r, 10 + Math.random() * 30));

  switch (command) {
    case 'get_tasks':
      return [...mockTasks];

    case 'add_task':
      mockTasks.unshift({ ...args!.task, id: String(Date.now()), runCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      return;

    case 'update_task': {
      const idx = mockTasks.findIndex(t => t.id === args!.task.id);
      if (idx >= 0) mockTasks[idx] = { ...mockTasks[idx], ...args!.task };
      return;
    }

    case 'delete_task': {
      const idx = mockTasks.findIndex(t => t.id === args!.id);
      if (idx >= 0) mockTasks.splice(idx, 1);
      return;
    }

    case 'toggle_task': {
      const t = mockTasks.find(t => t.id === args!.id);
      if (t) t.enabled = !t.enabled;
      return;
    }

    case 'get_settings':
      return { ...mockSettings };

    case 'save_settings':
      Object.assign(mockSettings, args!.settings);
      return;

    case 'test_run_task': {
      const task = args!.task;
      const exitCode = 0;
      const stdout = `[模拟] ${task.name} 运行成功\n输出内容示例\n耗时 42ms`;
      const result = {
        exitCode, stdout, stderr: '',
        durationMs: 42, error: null as string | null,
        emailSent: false, emailError: null as string | null,
      };
      if (task.notify?.emailTo) {
        result.emailSent = true;
      }
      return result;
    }

    case 'run_now': {
      const task = mockTasks.find(t => t.id === args!.id);
      if (!task) throw new Error('Task not found');
      runningTasks.add(task.id);
      return {
        status: 'success', exitCode: 0,
        stdout: `正在执行 ${task.name}...`, stderr: '',
        executedAt: new Date().toISOString(), durationMs: 0,
        error: null,
      };
    }

    case 'get_logs': {
      const logs = executionLogs[args!.taskId] || [];
      // Add some fake logs if empty
      if (logs.length === 0) {
        for (let i = 0; i < 5; i++) {
          logs.push({
            id: nextLogId++, taskId: args!.taskId,
            status: i % 3 === 0 ? 'failure' : 'success',
            exitCode: i % 3 === 0 ? 1 : 0,
            stdout: `Execution #${i + 1} output`,
            stderr: i % 3 === 0 ? 'Error occurred' : '',
            executedAt: new Date(Date.now() - i * 3600000).toISOString(),
            durationMs: Math.floor(Math.random() * 10000) + 100,
            error: i % 3 === 0 ? 'Exit code non-zero' : null,
            trigger: i % 2 === 0 ? 'scheduled' : 'manual',
            runCount: i + 1,
          });
        }
      }
      return logs;
    }

    case 'check_runtimes':
      return { javascript: true, python: true, rust: true, shell: true };

    case 'get_cron_times': {
      const exp = args!.expression;
      const count = args!.count || 5;
      const now = new Date();
      const results: string[] = [];
      // Simple cron simulator: for presets and basic patterns
      function nextRun(from: Date): Date | null {
        const parts = exp.trim().split(/\s+/);
        if (parts.length !== 5) return null;
        // Normalize: prepend 0 for seconds
        parts.unshift('0');
        const [sec, min, hour, dom, mon, dow] = parts;
        const d = new Date(from);
        d.setSeconds(parseInt(sec) || 0);
        d.setMilliseconds(0);
        // Try up to 366 days forward
        for (let day = 0; day < 366; day++) {
          const test = new Date(d);
          test.setDate(test.getDate() + day);
          if (dom !== '*' && test.getDate() !== parseInt(dom)) continue;
          if (mon !== '*') {
            const m = parseInt(mon);
            if (test.getMonth() + 1 !== m && !(mon.startsWith('*/') && (test.getMonth() + 1) % parseInt(mon.slice(2)) === 0)) continue;
          }
          if (dow !== '*' && test.getDay() !== parseInt(dow)) continue;
          // Match hour
          for (let h = 0; h < 24; h++) {
            if (hour !== '*' && h !== parseInt(hour) && !(hour.startsWith('*/') && h % parseInt(hour.slice(2)) === 0)) continue;
            // Match minute
            for (let m = 0; m < 60; m++) {
              if (min !== '*' && m !== parseInt(min) && !(min.startsWith('*/') && m % parseInt(min.slice(2)) === 0)) continue;
              test.setHours(h, m, parseInt(sec) || 0, 0);
              if (test > from) return test;
            }
          }
        }
        return null;
      }
      let from = now;
      for (let i = 0; i < count; i++) {
        const nr = nextRun(from);
        if (!nr) break;
        results.push(nr.toISOString());
        from = new Date(nr.getTime() + 1000);
      }
      return results;
    }

    default:
      console.warn('[Mock] Unhandled invoke:', command, args);
      return;
  }
}

/* ─── Exports matching @tauri-apps/api/core ─────────────────────────── */

export { invoke };
export default { invoke };

/* ─── Event mock ─────────────────────────────────────────────────────── */

type Listener = (event: { payload: any }) => void;
const eventListeners = new Map<string, Set<Listener>>();

export async function listen(event: string, handler: Listener): Promise<() => void> {
  if (!eventListeners.has(event)) eventListeners.set(event, new Set());
  eventListeners.get(event)!.add(handler);
  return () => { eventListeners.get(event)?.delete(handler); };
}

// Auto-trigger task-completed 2s after run_now
const origInvoke = invoke;
invoke = async function(command: string, args?: Record<string, any>) {
  const result = await origInvoke(command, args);
  if (command === 'run_now') {
    setTimeout(() => {
      const listeners = eventListeners.get('task-completed');
      if (listeners) {
        const mockResult = {
          status: 'success', exitCode: 0, stdout: 'Task completed', stderr: '',
          executedAt: new Date().toISOString(), durationMs: 1500, error: null,
        };
        listeners.forEach(fn => fn({ payload: mockResult }));
      }
    }, 2000);
  }
  return result;
};

/* ─── App API mocks ─────────────────────────────────────────────────── */

export async function getVersion() { return '0.2.1'; }
export async function getName() { return 'TriggerX'; }

/* ─── Plugin mocks ──────────────────────────────────────────────────── */

export async function isPermissionGranted() { return true; }
export async function requestPermission() { return 'granted'; }
export function sendNotification(_opts: any) { console.log('[Mock] Notification:', _opts.title, _opts.body); Notification.send(_opts); }
const Notification = { async send(_opts: any) {} };
export { Notification };
