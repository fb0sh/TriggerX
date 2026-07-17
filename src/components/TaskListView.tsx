import { useCallback, useState } from 'react';
import {
  Button,
  ActionList,
  TextInput,
  Label,
  ToggleSwitch,
  Tooltip,
  Spinner,
  IconButton,
  Dialog,
} from '@primer/react';
import {
  PlusIcon,
  SearchIcon,
  PlayIcon,
  CheckCircleFillIcon,
  XCircleFillIcon,
  ClockIcon,
  HistoryIcon,
  PencilIcon,
  TrashIcon,
} from '@primer/octicons-react';
import { useAppStore } from '../store';
import type { Task, TaskType } from '../types';
import type { CronTime } from '../cron-utils';
import { estimateNextRun } from '../cron-utils';
import { useRunNow } from '../hooks/useRunNow';
import { useCronTimeCache } from '../hooks/useCronTimeCache';
import { FlashMessage } from './FlashMessage';
import { formatDt, relativeTime, OutputBlock } from '../utils';

const typeLabels: Record<TaskType, string> = {
  command: '命令',
  shell: 'Shell',
  language: '代码',
};

const typeVariants: Record<TaskType, 'default' | 'success' | 'accent'> = {
  command: 'default',
  shell: 'success',
  language: 'accent',
};

function schedulePreview(schedule: Task['schedule'], nextRunCron?: CronTime): string {
  if (schedule.kind === 'once') {
    const d = new Date(schedule.executeAt);
    const diff = d.getTime() - Date.now();
    if (diff < 0) return `已过期 (${formatDt(d)})`;
    return formatDt(d);
  }
  if (nextRunCron) return nextRunCron.display;
  return schedule.label;
}

interface Props {
  onOpenNewTask: () => void;
  onOpenEdit: (task: Task) => void;
  onOpenHistory: (task: Task) => void;
}

export function TaskListView({ onOpenNewTask, onOpenEdit, onOpenHistory }: Props) {
  const { tasks, loading, deleteTask, toggleTask } = useAppStore();

  const [flashMsg, setFlashMsg] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'time' | 'name'>('time');
  const [filterEnabled, setFilterEnabled] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<Task | null>(null);
  const [expandedOutput, setExpandedOutput] = useState<Set<string>>(new Set());

  const onFlash = useCallback((msg: string) => setFlashMsg(msg), []);
  const { runningTasks, setupListener, handleRunNow } = useRunNow(onFlash);

  // Setup event listener (once on mount)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useState(() => { setupListener(); });

  const nextRunTimes = useCronTimeCache(tasks);

  let filtered = tasks.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()),
  );
  if (filterEnabled === 'enabled') filtered = filtered.filter(t => t.enabled);
  if (filterEnabled === 'disabled') filtered = filtered.filter(t => !t.enabled);
  if (sortBy === 'time') {
    filtered.sort((a, b) => estimateNextRun(a.schedule) - estimateNextRun(b.schedule));
  } else {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  }

  async function handleDelete(id: string, name: string) {
    await deleteTask(id);
    setDeleteConfirm(null);
    setFlashMsg(`已删除「${name}」`);
  }

  return (
    <>
      <FlashMessage message={flashMsg} onClose={() => setFlashMsg(null)} />

      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: 8, padding: '12px 16px',
        borderBottom: '1px solid var(--borderColor-muted, #d0d7de)', alignItems: 'center',
      }}>
        <TextInput autoCapitalize="none" autoCorrect="off"
          leadingVisual={SearchIcon} placeholder="搜索任务..."
          value={search} onChange={e => setSearch(e.target.value)} size="small"
        />
        <Button variant="primary" leadingVisual={PlusIcon} onClick={onOpenNewTask} size="small">
          新建任务
        </Button>

        <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginLeft: 8 }}>
          {(['all', 'enabled', 'disabled'] as const).map(f => (
            <button key={f} onClick={() => setFilterEnabled(f)} style={{
              padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
              border: '1px solid var(--borderColor-muted, #d0d7de)',
              background: filterEnabled === f ? 'var(--bgColor-accent-emphasis, #0969da)' : 'transparent',
              color: filterEnabled === f ? '#fff' : 'var(--fgColor-muted, #656d76)', cursor: 'pointer',
            }}>
              {{ all: '全部', enabled: '已启用', disabled: '已禁用' }[f]}
            </button>
          ))}
        </div>

        <button onClick={() => setSortBy(sortBy === 'time' ? 'name' : 'time')} style={{
          padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
          border: '1px solid var(--borderColor-muted, #d0d7de)', background: 'transparent',
          color: 'var(--fgColor-muted, #656d76)', cursor: 'pointer',
        }}>
          {sortBy === 'time' ? '按时间 ↓' : '按名称 ↓'}
        </button>

        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--fgColor-muted, #656d76)' }}>
          共 {tasks.length} 个任务
        </span>
      </div>

      {/* Task list */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 24 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><Spinner /></div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 64, color: 'var(--fgColor-muted, #656d76)' }}>
            <span style={{ fontSize: 16 }}>
              {search ? '没有匹配的任务' : '还没有任务，点击"+ 新建任务"开始'}
            </span>
          </div>
        ) : (
          <ActionList>
            {filtered.map(task => (
              <ActionList.Item key={task.id} as="div" role="listitem" onSelect={() => {}}
                style={{ padding: '10px 24px', borderBottom: '1px solid var(--borderColor-muted, #d0d7de)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                  <span id={`tl-${task.id}`} style={{ display: 'none' }}>
                    {task.enabled ? '已启用' : '已禁用'}
                  </span>
                  <ToggleSwitch aria-labelledby={`tl-${task.id}`} checked={task.enabled}
                    onClick={() => toggleTask(task.id, !task.enabled)} size="small" />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{task.name}</span>
                      <Label variant={typeVariants[task.config.type]} size="small">
                        {typeLabels[task.config.type]}
                      </Label>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'var(--fgColor-muted, #656d76)' }}>
                      <span>
                        <ClockIcon size={14} />{' '}
                        {schedulePreview(task.schedule, nextRunTimes[task.id])}
                        <span style={{ marginLeft: 6, fontWeight: 600 }}>#{(task.runCount ?? 0) + 1}</span>
                      </span>
                      {task.lastRun && (
                        <span>
                          上次: {relativeTime(task.lastRun.executedAt)}
                          {task.lastRun.status === 'success' ? (
                            <span style={{ color: 'var(--fgColor-success, #1a7f37)', marginLeft: 4 }}>
                              <CheckCircleFillIcon size={14} />
                            </span>
                          ) : (
                            <span style={{ color: 'var(--fgColor-danger, #cf222e)', marginLeft: 4 }}>
                              <XCircleFillIcon size={14} />
                            </span>
                          )}
                        </span>
                      )}
                      {task.lastRun && (task.lastRun.stdout || task.lastRun.stderr) && (
                        <button onClick={() => setExpandedOutput(prev => {
                          const n = new Set(prev);
                          if (n.has(task.id)) n.delete(task.id); else n.add(task.id);
                          return n;
                        })} style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: 11, color: 'var(--fgColor-accent, #0969da)', padding: 0, marginLeft: 8,
                        }}>
                          {expandedOutput.has(task.id) ? '收起输出' : '查看输出'}
                        </button>
                      )}
                    </div>
                    {task.lastRun && expandedOutput.has(task.id) && (
                      <div style={{ marginTop: 6 }}>
                        <OutputBlock stdout={task.lastRun.stdout} stderr={task.lastRun.stderr} />
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <Tooltip text="立即执行" direction="n">
                      <IconButton icon={PlayIcon} aria-label="立即执行" variant="invisible" size="small"
                        onClick={() => handleRunNow(task.id, task.name)}
                        disabled={runningTasks.has(task.id)} />
                    </Tooltip>
                    <Tooltip text="执行历史" direction="n">
                      <IconButton icon={HistoryIcon} aria-label="执行历史" variant="invisible" size="small"
                        onClick={() => onOpenHistory(task)} />
                    </Tooltip>
                    <Tooltip text="编辑" direction="n">
                      <IconButton icon={PencilIcon} aria-label="编辑" variant="invisible" size="small"
                        onClick={() => onOpenEdit(task)} disabled={runningTasks.has(task.id)} />
                    </Tooltip>
                    <Tooltip text="删除" direction="n">
                      <IconButton icon={TrashIcon} aria-label="删除" variant="invisible" size="small"
                        onClick={() => setDeleteConfirm(task)} disabled={runningTasks.has(task.id)} />
                    </Tooltip>
                  </div>
                </div>
              </ActionList.Item>
            ))}
          </ActionList>
        )}
      </div>

      {/* Delete confirmation */}
      {deleteConfirm && (
        <Dialog title="确认删除" onClose={() => setDeleteConfirm(null)} aria-label="确认删除" width="medium">
          <div style={{ padding: 16 }}>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
              确定要删除任务 <strong>「{deleteConfirm.name}」</strong> 吗？此操作不可撤销。
            </p>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: 8,
            padding: '12px 16px', borderTop: '1px solid var(--borderColor-muted, #d0d7de)',
          }}>
            <Button onClick={() => setDeleteConfirm(null)} size="small">取消</Button>
            <Button variant="danger" size="small"
              onClick={() => handleDelete(deleteConfirm.id, deleteConfirm.name)}>
              确认删除
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
