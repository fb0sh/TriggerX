import { useEffect, useState } from 'react';
import { Dialog, Button, StateLabel } from '@primer/react';
import type { Task, ExecutionLog } from '../types';

interface Props {
  task: Task;
  onClose: () => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export function TaskHistory({ task, onClose }: Props) {
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const result = await invoke<ExecutionLog[]>('get_logs', { taskId: task.id });
        setLogs(result);
      } catch {
        // Dev fallback — show lastRun if available
        if (task.lastRun) {
          setLogs([{
            id: 0,
            taskId: task.id,
            status: task.lastRun.status,
            exitCode: task.lastRun.exitCode,
            stdout: task.lastRun.stdout,
            stderr: task.lastRun.stderr,
            executedAt: task.lastRun.executedAt,
            durationMs: task.lastRun.durationMs,
            error: task.lastRun.error ?? null,
            trigger: 'scheduled',
            runCount: task.runCount ?? 0,
          }]);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [task.id, task.lastRun]);

  return (
    <Dialog
      title={`执行历史 - ${task.name}`}
      onClose={onClose}
      aria-label={`执行历史 - ${task.name}`}
    >
      <div style={{ padding: 16, minHeight: 100, maxHeight: '60vh', overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--fgColor-muted, #656d76)' }}>
            加载中…
          </div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--fgColor-muted, #656d76)' }}>
            <span style={{ fontSize: 14 }}>暂无执行记录</span>
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} style={{
              padding: '12px 0',
              borderBottom: '1px solid var(--borderColor-muted, #d0d7de)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <StateLabel
                  status={log.status === 'success' ? 'issueClosed' : 'pullClosed'}
                  variant="small"
                >
                  {log.status === 'success' ? '成功' : '失败'}
                </StateLabel>
                <span style={{ fontSize: 12, color: 'var(--fgColor-muted, #656d76)' }}>
                  {formatTime(log.executedAt)}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fgColor-muted, #656d76)' }}>
                  #{log.runCount}
                </span>
                {log.durationMs != null && (
                  <span style={{ fontSize: 12, color: 'var(--fgColor-muted, #656d76)' }}>
                    耗时 {log.durationMs > 1000
                      ? `${(log.durationMs / 1000).toFixed(1)}s`
                      : `${log.durationMs}ms`}
                  </span>
                )}
                <span style={{ fontSize: 11, color: 'var(--fgColor-muted, #656d76)', marginLeft: 4 }}>
                  {log.trigger === 'manual' ? '[手动]' : '[定时]'}
                </span>
                {log.exitCode != null && (
                  <span style={{ fontSize: 12, color: 'var(--fgColor-muted, #656d76)' }}>
                    退出码: {log.exitCode}
                  </span>
                )}
              </div>

              {log.error && (
                <div style={{
                  padding: '8px 12px', marginBottom: 8, borderRadius: 6,
                  backgroundColor: 'var(--bgColor-danger-muted, #ffebe9)',
                  color: 'var(--fgColor-danger, #cf222e)', fontSize: 13,
                  fontFamily: 'monospace', whiteSpace: 'pre-wrap',
                }}>
                  {log.error}
                </div>
              )}

              {log.stdout && (
                <div style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fgColor-muted, #656d76)', display: 'block', marginBottom: 4 }}>
                    STDOUT
                  </span>
                  <pre style={{
                    margin: 0, padding: '8px 12px', borderRadius: 6,
                    backgroundColor: 'var(--bgColor-muted, #f6f8fa)', fontSize: 12,
                    fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                    maxHeight: 200, overflow: 'auto',
                  }}>
                    {log.stdout}
                  </pre>
                </div>
              )}

              {log.stderr && (
                <div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fgColor-muted, #656d76)', display: 'block', marginBottom: 4 }}>
                    STDERR
                  </span>
                  <pre style={{
                    margin: 0, padding: '8px 12px', borderRadius: 6,
                    backgroundColor: 'var(--bgColor-danger-muted, #ffebe9)', fontSize: 12,
                    fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                    maxHeight: 200, overflow: 'auto',
                  }}>
                    {log.stderr}
                  </pre>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div style={{
        display: 'flex', justifyContent: 'flex-end', gap: 8,
        padding: '12px 16px',
        borderTop: '1px solid var(--borderColor-muted, #d0d7de)',
      }}>
        <Button onClick={onClose} size="small">关闭</Button>
      </div>
    </Dialog>
  );
}
