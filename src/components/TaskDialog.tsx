import { useState } from 'react';
import { Dialog, TextInput, FormControl, Button } from '@primer/react';
import { CommandForm } from './CommandForm';
import { LanguageForm } from './LanguageForm';
import { ShellForm } from './ShellForm';
import { ScheduleSection } from './ScheduleSection';
import { NotificationSection, DEFAULT_EMAIL_TEMPLATE } from './NotificationSection';
import type { NotificationState } from './NotificationSection';
import { TestRunSection } from './TestRunSection';
import { useAppStore } from '../store';
import type { Task, TaskType, Schedule, LanguageRuntime } from '../types';

interface Props {
  task: Task | null;
  smtpConfigured?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Extract initial form values from a Task using discriminated union narrowing. */
function initFromTask(task: Task | null) {
  if (!task) {
    return {
      name: '', taskType: 'shell' as TaskType,
      shellCommand: '', cmdBase: '', cmdParams: [{ flag: '', value: '' }],
      language: 'javascript' as LanguageRuntime, code: '',
    };
  }
  const cfg = task.config;
  let shellCommand = '', cmdBase = '', cmdParams = [{ flag: '', value: '' }];
  let language: LanguageRuntime = 'javascript', code = '';

  if (cfg.type === 'shell') {
    shellCommand = cfg.shell.command;
  } else if (cfg.type === 'command') {
    cmdBase = cfg.command.base;
    cmdParams = cfg.command.params.map(p => ({ flag: p.flag, value: p.value }));
  } else if (cfg.type === 'language') {
    language = cfg.language.language;
    code = cfg.language.code;
  }

  return {
    name: task.name, taskType: cfg.type,
    shellCommand, cmdBase, cmdParams, language, code,
  };
}

function initNotification(task: Task | null): NotificationState {
  return {
    system: task?.notify?.system ?? true,
    systemOnFailureOnly: task?.notify?.systemOnFailureOnly ?? false,
    email: !!task?.notify?.emailTo,
    emailTo: task?.notify?.emailTo ?? '',
    emailOnFailureOnly: task?.notify?.emailOnFailureOnly ?? false,
    emailTemplate: task?.notify?.emailTemplate ?? DEFAULT_EMAIL_TEMPLATE,
  };
}

export function TaskDialog({ task, smtpConfigured = false, onClose, onSaved }: Props) {
  const { addTask, updateTask } = useAppStore();
  const init = initFromTask(task);

  const [name, setName] = useState(init.name);
  const [taskType, setTaskType] = useState<TaskType>(init.taskType);
  const [shellCommand, setShellCommand] = useState(init.shellCommand);
  const [cmdBase, setCmdBase] = useState(init.cmdBase);
  const [cmdParams, setCmdParams] = useState(init.cmdParams);
  const [language, setLanguage] = useState<LanguageRuntime>(init.language);
  const [code, setCode] = useState(init.code);
  const [schedule, setSchedule] = useState<Schedule>(task?.schedule ?? { kind: 'cron', expression: '*/5 * * * *', label: '*/5 * * * *' });
  const [notify, setNotify] = useState<NotificationState>(() => initNotification(task));
  const [error, setError] = useState<string | null>(null);
  const isEditing = !!task;

  function buildTaskConfig(): Task['config'] {
    switch (taskType) {
      case 'shell': return { type: 'shell', shell: { command: shellCommand } };
      case 'command': return { type: 'command', command: { base: cmdBase, params: cmdParams.filter(p => p.flag.trim()) } };
      case 'language': return { type: 'language', language: { language, code } };
    }
  }

  function buildTaskTmp(): Task {
    const now = new Date().toISOString();
    return {
      id: task?.id ?? generateId(),
      name: name.trim() || '未命名任务',
      enabled: task?.enabled ?? true,
      config: buildTaskConfig(),
      schedule,
      lastRun: null,
      runCount: task?.runCount ?? 0,
      createdAt: task?.createdAt ?? now,
      updatedAt: now,
      notify: {
        system: notify.system,
        systemOnFailureOnly: notify.systemOnFailureOnly || undefined,
        email: notify.email || undefined,
        emailTo: notify.emailTo.trim() || undefined,
        emailOnFailureOnly: notify.emailOnFailureOnly || undefined,
        emailTemplate: notify.emailTemplate.trim() || undefined,
      },
    };
  }

  function validate(): boolean {
    if (!name.trim()) { setError('请输入任务名称'); return false; }
    if (taskType === 'shell' && !shellCommand.trim()) { setError('请输入 Shell 命令'); return false; }
    if (taskType === 'command' && !cmdBase.trim()) { setError('请输入命令名称'); return false; }
    if (taskType === 'language' && !code.trim()) { setError('请输入代码'); return false; }
    return true;
  }

  async function handleSave() {
    setError(null);
    if (!validate()) return;
    const t = buildTaskTmp();
    if (isEditing) await updateTask(t);
    else await addTask(t);
    onSaved();
  }

  return (
    <Dialog
      title={isEditing ? '编辑任务' : '新建任务'}
      onClose={onClose}
      aria-label={isEditing ? '编辑任务' : '新建任务'}
      width="80%"
    >
      <div style={{ padding: 16, maxHeight: '70vh', overflowY: 'auto' }}>
        {error && (
          <div style={{
            padding: '8px 12px', marginBottom: 12, borderRadius: 6,
            backgroundColor: 'var(--bgColor-danger-emphasis, #cf222e)',
            color: '#fff', fontSize: 14,
          }}>
            {error}
          </div>
        )}

        {/* 名称 */}
        <div style={{ marginBottom: 16 }}>
          <FormControl>
            <FormControl.Label>任务名称</FormControl.Label>
            <TextInput autoCapitalize="none" autoCorrect="off"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="例如：备份数据库"
              block
            />
          </FormControl>
        </div>

        {/* 类型 */}
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 600, display: 'block', marginBottom: 4 }}>任务类型</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(['shell', 'command', 'language'] as TaskType[]).map(t => (
              <Button key={t} variant={taskType === t ? 'primary' : 'default'} size="small"
                onClick={() => setTaskType(t)}>
                {{ shell: 'Shell 命令', command: '命令行工具', language: '代码片段' }[t]}
              </Button>
            ))}
          </div>
        </div>

        {/* 类型专属表单 */}
        {taskType === 'shell' && (
          <div style={{ marginBottom: 16 }}>
            <ShellForm value={{ command: shellCommand }} onChange={v => setShellCommand(v.command)} />
          </div>
        )}
        {taskType === 'command' && (
          <div style={{ marginBottom: 16 }}>
            <CommandForm
              value={{ base: cmdBase, params: cmdParams }}
              onChange={v => { setCmdBase(v.base); setCmdParams(v.params); }}
            />
          </div>
        )}
        {taskType === 'language' && (
          <div style={{ marginBottom: 16 }}>
            <LanguageForm
              value={{ language, code }}
              onChange={v => { setLanguage(v.language as LanguageRuntime); setCode(v.code); }}
            />
          </div>
        )}

        {/* 调度 */}
        <hr style={{ border: 'none', borderTop: '1px solid var(--borderColor-muted, #d0d7de)', margin: '16px 0' }} />
        <ScheduleSection schedule={schedule} onChange={setSchedule} />

        {/* 通知 */}
        <hr style={{ border: 'none', borderTop: '1px solid var(--borderColor-muted, #d0d7de)', margin: '16px 0' }} />
        <NotificationSection value={notify} onChange={setNotify} smtpConfigured={smtpConfigured} />

        {/* 测试运行 */}
        <hr style={{ border: 'none', borderTop: '1px solid var(--borderColor-muted, #d0d7de)', margin: '16px 0' }} />
        <TestRunSection buildTask={buildTaskTmp} onValidate={validate} onError={setError} emailTo={notify.emailTo} />
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', gap: 8,
        padding: '12px 16px',
        borderTop: '1px solid var(--borderColor-muted, #d0d7de)',
      }}>
        <Button onClick={onClose} size="small">取消</Button>
        <Button variant="primary" onClick={handleSave} size="small">
          {isEditing ? '保存' : '创建'}
        </Button>
      </div>
    </Dialog>
  );
}
