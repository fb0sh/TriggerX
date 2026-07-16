import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  PageHeader,
  Button,
  ActionList,
  TextInput,
  Label,
  ToggleSwitch,
  Tooltip,
  Spinner,
  IconButton,
} from '@primer/react';
import {
  PlusIcon,
  GearIcon,
  SearchIcon,
  PlayIcon,
  CheckCircleFillIcon,
  XCircleFillIcon,
  ClockIcon,
  HistoryIcon,
  PencilIcon,
  TrashIcon,
} from '@primer/octicons-react';
import { useAppStore } from './store';
const TaskDialog = lazy(() => import('./components/TaskDialog').then(m => ({ default: m.TaskDialog })));
const SettingsDialog = lazy(() => import('./components/SettingsDialog').then(m => ({ default: m.SettingsDialog })));
const TaskHistory = lazy(() => import('./components/TaskHistory').then(m => ({ default: m.TaskHistory })));
import type { Task, TaskType } from './types';

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

function schedulePreview(schedule: Task['schedule']): string {
  if (schedule.kind === 'cron') return schedule.label;
  const d = new Date(schedule.executeAt);
  const now = Date.now();
  const diff = d.getTime() - now;
  if (diff < 0) return '已过期';
  if (diff < 60000) return '即将执行';
  if (diff < 3600000) return `${Math.round(diff / 60000)} 分钟后`;
  if (diff < 86400000) return `${Math.round(diff / 3600000)} 小时后`;
  return d.toLocaleDateString('zh-CN');
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  return `${Math.floor(diff / 86400000)} 天前`;
}

export default function App() {
  const { tasks, settings, loading, loadTasks, deleteTask, toggleTask, loadSettings } = useAppStore();
  const [runningTasks, setRunningTasks] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'time' | 'name'>('time');
  const [filterEnabled, setFilterEnabled] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyTask, setHistoryTask] = useState<Task | null>(null);
  const [flashMsg, setFlashMsg] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    loadTasks();
    loadSettings();
  }, [loadTasks, loadSettings]);

  useEffect(() => {
    if (flashMsg) {
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlashMsg(null), 3000);
    }
  }, [flashMsg]);

  function estimateNextRun(task: Task): number {
    if (task.schedule.kind === 'once') {
      return new Date(task.schedule.executeAt).getTime();
    }
    // Cron: rough estimate based on expression
    const exp = task.schedule.expression;
    if (exp.startsWith('*/')) {
      const min = parseInt(exp.slice(2)) || 5;
      return Date.now() + min * 60000;
    }
    if (exp.startsWith('0 */')) {
      const hour = parseInt(exp.slice(4)) || 1;
      return Date.now() + hour * 3600000;
    }
    if (exp.startsWith('0 0 *')) return Date.now() + 86400000;
    if (exp.startsWith('0 9 *')) return Date.now() + (Date.now() % 86400000 < 9*3600000 ? 9*3600000 - Date.now() % 86400000 : 86400000 - Date.now() % 86400000 + 9*3600000);
    return Date.now() + 3600000;
  }

  let filtered = tasks.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()),
  );
  if (filterEnabled === 'enabled') filtered = filtered.filter(t => t.enabled);
  if (filterEnabled === 'disabled') filtered = filtered.filter(t => !t.enabled);
  if (sortBy === 'time') {
    filtered.sort((a, b) => estimateNextRun(a) - estimateNextRun(b));
  } else {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  }

  function openNewTask() {
    setEditingTask(null);
    setTaskDialogOpen(true);
  }

  function openEdit(task: Task) {
    setEditingTask(task);
    setTaskDialogOpen(true);
  }

  async function handleDelete(id: string, name: string) {
    await deleteTask(id);
    setFlashMsg(`已删除「${name}」`);
  }

  async function handleRunNow(id: string) {
    setRunningTasks(prev => new Set(prev).add(id));
    const taskName = tasks.find(t => t.id === id)?.name || '';
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result: {
        status: string; exitCode: number | null;
        stdout: string; stderr: string;
        executedAt: string; durationMs: number | null;
        error: string | null;
      } = await invoke('run_now', { id });
      useAppStore.setState(s => ({
        tasks: s.tasks.map(t =>
          t.id === id ? {
            ...t,
            lastRun: {
              status: result.status as 'success' | 'failure',
              exitCode: result.exitCode,
              stdout: result.stdout,
              stderr: result.stderr,
              executedAt: result.executedAt,
              durationMs: result.durationMs,
              error: result.error ?? undefined,
            },
          } : t
        ),
      }));
      setFlashMsg(`「${taskName}」执行完成`);
    } catch (e) {
      setFlashMsg(`「${taskName}」执行失败`);
    } finally {
      setRunningTasks(prev => { const next = new Set(prev); next.delete(id); return next; });
    }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Flash notification */}
      {flashMsg && (
        <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 9999, maxWidth: 400 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, fontSize: 14, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', backgroundColor: flashMsg.includes('失败') ? 'var(--bgColor-danger-emphasis, #cf222e)' : 'var(--bgColor-success-emphasis, #1a7f37)', color: '#fff' }}>
            <span style={{ flex: 1 }}>{flashMsg}</span>
            <button
              onClick={() => setFlashMsg(null)}
              style={{
                background: 'none', border: 'none', color: 'inherit',
                cursor: 'pointer', padding: '0 0 0 8px', fontSize: 18, lineHeight: 1, opacity: 0.7,
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '0 16px' }}>
      <PageHeader>
        <PageHeader.TitleArea>
          <PageHeader.Title>
            <span style={{ fontWeight: 600, fontSize: 20 }}>
              TriggerX <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--fgColor-muted, #656d76)' }}>v0.1.0</span>
            </span>
          </PageHeader.Title>
        </PageHeader.TitleArea>
        <PageHeader.Actions>
          <Tooltip text="设置" direction="s">
            <IconButton
              icon={GearIcon}
              aria-label="设置"
              onClick={() => setSettingsOpen(true)}
            />
          </Tooltip>
        </PageHeader.Actions>
      </PageHeader>
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '12px 16px',
          borderBottom: '1px solid var(--borderColor-muted, #d0d7de)',
          alignItems: 'center',
        }}
      >
        <TextInput autoCapitalize="none" autoCorrect="off" 
          leadingVisual={SearchIcon}
          placeholder="搜索任务..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          size="small"
        />
        <Button
          variant="primary"
          leadingVisual={PlusIcon}
          onClick={openNewTask}
          size="small"
        >
          新建任务
        </Button>

        <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginLeft: 8 }}>
          {(['all', 'enabled', 'disabled'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterEnabled(f)}
              style={{
                padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                border: '1px solid var(--borderColor-muted, #d0d7de)',
                background: filterEnabled === f ? 'var(--bgColor-accent-emphasis, #0969da)' : 'transparent',
                color: filterEnabled === f ? '#fff' : 'var(--fgColor-muted, #656d76)',
                cursor: 'pointer',
              }}
            >
              {{ all: '全部', enabled: '已启用', disabled: '已禁用' }[f]}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button
            onClick={() => setSortBy(sortBy === 'time' ? 'name' : 'time')}
            style={{
              padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
              border: '1px solid var(--borderColor-muted, #d0d7de)',
              background: 'transparent',
              color: 'var(--fgColor-muted, #656d76)',
              cursor: 'pointer',
            }}
          >
            {sortBy === 'time' ? '按时间 ↓' : '按名称 ↓'}
          </button>
        </div>

        <span
          style={{
            marginLeft: 'auto',
            fontSize: 12,
            color: 'var(--fgColor-muted, #656d76)',
          }}
        >
          共 {tasks.length} 个任务
        </span>
      </div>

      {/* Task list */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 24 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: 64,
              color: 'var(--fgColor-muted, #656d76)',
            }}
          >
            <span style={{ fontSize: 16 }}>
              {search ? '没有匹配的任务' : '还没有任务，点击"+ 新建任务"开始'}
            </span>
          </div>
        ) : (
          <ActionList>
            {filtered.map(task => (
              <ActionList.Item
                key={task.id}
                onSelect={() => {}}
                style={{
                  padding: '10px 24px',
                  borderBottom: '1px solid var(--borderColor-muted, #d0d7de)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                  }}
                >
                  {/* Enable toggle - using a span as label target */}
                  <span id={`tl-${task.id}`} style={{ display: 'none' }}>
                    {task.enabled ? '已启用' : '已禁用'}
                  </span>
                  <ToggleSwitch
                    aria-labelledby={`tl-${task.id}`}
                    checked={task.enabled}
                    onClick={() => toggleTask(task.id, !task.enabled)}
                    size="small"
                  />

                  {/* Task info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 2,
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: 14 }}>
                        {task.name}
                      </span>
                      <Label variant={typeVariants[task.config.type]} size="small">
                        {typeLabels[task.config.type]}
                      </Label>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        fontSize: 12,
                        color: 'var(--fgColor-muted, #656d76)',
                      }}
                    >
                      <span>
                        <ClockIcon size={14} />{' '}
                        {schedulePreview(task.schedule)}
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
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <Tooltip text="立即执行" direction="n">
                      <IconButton
                        icon={PlayIcon}
                        aria-label="立即执行"
                        variant="invisible"
                        size="small"
                        onClick={() => handleRunNow(task.id)}
                        disabled={runningTasks.has(task.id)}
                      />
                    </Tooltip>
                    <Tooltip text="执行历史" direction="n">
                      <IconButton
                        icon={HistoryIcon}
                        aria-label="执行历史"
                        variant="invisible"
                        size="small"
                        onClick={() => setHistoryTask(task)}
                      />
                    </Tooltip>
                    <Tooltip text="编辑" direction="n">
                      <IconButton
                        icon={PencilIcon}
                        aria-label="编辑"
                        variant="invisible"
                        size="small"
                        onClick={() => openEdit(task)}
                      />
                    </Tooltip>
                    <Tooltip text="删除" direction="n">
                      <IconButton
                        icon={TrashIcon}
                        aria-label="删除"
                        variant="invisible"
                        size="small"
                        onClick={() => handleDelete(task.id, task.name)}
                      />
                    </Tooltip>
                  </div>
                </div>
              </ActionList.Item>
            ))}
          </ActionList>
        )}
      </div>

      {/* Dialogs */}
      <Suspense fallback={null}>
        {taskDialogOpen && (
          <TaskDialog
            task={editingTask}
            smtpConfigured={!!(settings.smtp?.host && settings.smtp?.username)}
            onClose={() => setTaskDialogOpen(false)}
            onSaved={() => {
              setTaskDialogOpen(false);
              setFlashMsg(editingTask ? `已更新「${editingTask.name}」` : '已创建新任务');
            }}
          />
        )}

        {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}

        {historyTask && (
          <TaskHistory
            task={historyTask}
            onClose={() => setHistoryTask(null)}
          />
        )}
      </Suspense>
    </div>
  );
}
