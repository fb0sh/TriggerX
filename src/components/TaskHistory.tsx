import { useEffect, useState } from 'react';
import { Dialog, Button, StateLabel } from '@primer/react';
import { getLogs } from '../ipc';
import { formatDt, formatDuration, formatStatus, OutputBlock } from '../utils';
import type { Task, ExecutionLog } from '../types';

interface Props {
  task: Task;
  onClose: () => void;
}

export function TaskHistory({ task, onClose }: Props) {
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const result = await getLogs(task.id);
        setLogs(result);
      } catch {
        if (task.lastRun) {
          setLogs([{
            id: 0, taskId: task.id, status: task.lastRun.status,
            exitCode: task.lastRun.exitCode, stdout: task.lastRun.stdout,
            stderr: task.lastRun.stderr, executedAt: task.lastRun.executedAt,
            durationMs: task.lastRun.durationMs, error: task.lastRun.error ?? null,
            trigger: 'scheduled', runCount: task.runCount ?? 0,
          }]);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [task.id, task.lastRun]);

  return (
    <Dialog title={`执行历史 - ${task.name}`} onClose={onClose} aria-label={`执行历史 - ${task.name}`}>
      <div style={{ padding: 16, minHeight: 100, maxHeight: '60vh', overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--fgColor-muted, #656d76)' }}>加载中…</div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--fgColor-muted, #656d76)' }}>
            <span style={{ fontSize: 14 }}>暂无执行记录</span>
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--borderColor-muted, #d0d7de)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <StateLabel status={log.status === 'success' ? 'issueClosed' : 'pullClosed'} variant="small">
                  {formatStatus(log.status)}
                </StateLabel>
                <span style={{ fontSize: 12, color: 'var(--fgColor-muted, #656d76)' }}>{formatDt(new Date(log.executedAt))}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fgColor-muted, #656d76)' }}>#{log.runCount}</span>
                {log.durationMs != null && (
                  <span style={{ fontSize: 12, color: 'var(--fgColor-muted, #656d76)' }}>耗时 {formatDuration(log.durationMs)}</span>
                )}
                <span style={{ fontSize: 11, color: 'var(--fgColor-muted, #656d76)', marginLeft: 4 }}>
                  {log.trigger === 'manual' ? '[手动]' : '[定时]'}
                </span>
                {log.exitCode != null && (
                  <span style={{ fontSize: 12, color: 'var(--fgColor-muted, #656d76)' }}>退出码: {log.exitCode}</span>
                )}
              </div>

              {log.error && (
                <div style={{
                  padding: '8px 12px', marginBottom: 8, borderRadius: 6,
                  backgroundColor: 'var(--bgColor-danger-muted, #ffebe9)',
                  color: 'var(--fgColor-danger, #cf222e)', fontSize: 13, fontFamily: 'monospace', whiteSpace: 'pre-wrap',
                }}>{log.error}</div>
              )}

              <OutputBlock stdout={log.stdout} stderr={log.stderr} maxHeight={200} />
            </div>
          ))
        )}
      </div>

      <div style={{
        display: 'flex', justifyContent: 'flex-end', gap: 8,
        padding: '12px 16px', borderTop: '1px solid var(--borderColor-muted, #d0d7de)',
      }}>
        <Button onClick={onClose} size="small">关闭</Button>
      </div>
    </Dialog>
  );
}
