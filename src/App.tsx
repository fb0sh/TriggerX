import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { PageHeader, IconButton, Tooltip } from '@primer/react';
import { GearIcon } from '@primer/octicons-react';
import { useAppStore } from './store';
import { TaskListView } from './components/TaskListView';
import { FlashMessage } from './components/FlashMessage';
const TaskDialog = lazy(() => import('./components/TaskDialog').then(m => ({ default: m.TaskDialog })));
const SettingsDialog = lazy(() => import('./components/SettingsDialog').then(m => ({ default: m.SettingsDialog })));
const TaskHistory = lazy(() => import('./components/TaskHistory').then(m => ({ default: m.TaskHistory })));
import type { Task } from './types';

export default function App() {
  const { loadTasks, loadSettings, settings } = useAppStore();
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyTask, setHistoryTask] = useState<Task | null>(null);
  const [flashMsg, setFlashMsg] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState('0.3.0');

  const dismissFlash = useCallback(() => setFlashMsg(null), []);

  useEffect(() => {
    loadTasks();
    loadSettings();
    (async () => {
      try {
        const { getVersion } = await import('@tauri-apps/api/app');
        setAppVersion(await getVersion());
      } catch { /* use default */ }
    })();
  }, [loadTasks, loadSettings]);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <FlashMessage message={flashMsg} onClose={dismissFlash} />

      <div style={{ padding: '0 16px' }}>
      <PageHeader>
        <PageHeader.TitleArea>
          <PageHeader.Title>
            <span style={{ fontWeight: 600, fontSize: 20 }}>
              TriggerX <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--fgColor-muted, #656d76)' }}>v{appVersion}</span>
            </span>
          </PageHeader.Title>
        </PageHeader.TitleArea>
        <PageHeader.Actions>
          <Tooltip text="设置" direction="s">
            <IconButton icon={GearIcon} aria-label="设置" onClick={() => setSettingsOpen(true)} />
          </Tooltip>
        </PageHeader.Actions>
      </PageHeader>
      </div>

      <TaskListView
        onOpenNewTask={() => { setEditingTask(null); setTaskDialogOpen(true); }}
        onOpenEdit={(task) => { setEditingTask(task); setTaskDialogOpen(true); }}
        onOpenHistory={(task) => setHistoryTask(task)}
      />

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
        {historyTask && <TaskHistory task={historyTask} onClose={() => setHistoryTask(null)} />}
      </Suspense>
    </div>
  );
}
