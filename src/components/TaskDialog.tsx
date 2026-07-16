import { useState } from 'react';
import {
  Dialog,
  TextInput,
  FormControl,
  Select,
  Textarea,
  Button,
  Label,
  ToggleSwitch,
} from '@primer/react';
import { PlayIcon, CheckIcon, XIcon } from '@primer/octicons-react';
import { useAppStore } from '../store';
import type {
  Task, TaskType, Schedule, LanguageRuntime, TestRunResult, RuntimeCheck,
} from '../types';

interface Props {
  task: Task | null;
  smtpConfigured?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const cronPresets = [
  { value: '*/5 * * * *', label: '每 5 分钟' },
  { value: '*/15 * * * *', label: '每 15 分钟' },
  { value: '*/30 * * * *', label: '每 30 分钟' },
  { value: '0 * * * *', label: '每小时' },
  { value: '0 */6 * * *', label: '每 6 小时' },
  { value: '0 0 * * *', label: '每天凌晨' },
  { value: '0 9 * * *', label: '每天 9:00' },
  { value: '0 0 * * 1', label: '每周一' },
  { value: '0 0 1 * *', label: '每月 1 号' },
  { value: 'custom', label: '自定义 Cron' },
];

const languageOptions: { value: LanguageRuntime; label: string }[] = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'shell', label: 'Shell' },
  { value: 'rust', label: 'Rust' },
];

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function buildCommandStr(task: Task): string {
  const cfg = task.config;
  if (cfg.type === 'shell') return cfg.shell.command;
  if (cfg.type === 'command') {
    const flags = cfg.command.params
      .filter(p => p.flag.trim())
      .map(p => `${p.flag}${p.value ? ' ' + p.value : ''}`)
      .join(' ');
    return `${cfg.command.base} ${flags}`.trim();
  }
  if (cfg.type === 'language') {
    const lang = cfg.language.language;
    const code = cfg.language.code;
    if (lang === 'javascript') return `node -e ${JSON.stringify(code)}`;
    if (lang === 'python') return `python3 -c ${JSON.stringify(code)}`;
    if (lang === 'shell') return `sh -c ${JSON.stringify(code)}`;
    if (lang === 'rust') return `rustc -o /tmp/tx_run /tmp/tx_run.rs && /tmp/tx_run.rs`;
  }
  return '';
}

export function TaskDialog({ task, smtpConfigured = false, onClose, onSaved }: Props) {
  const { addTask, updateTask } = useAppStore();

  const [name, setName] = useState(task?.name ?? '');
  const [taskType, setTaskType] = useState<TaskType>(task?.config.type ?? 'shell');
  const [scheduleKind, setScheduleKind] = useState<'cron' | 'once'>(
    task?.schedule.kind ?? 'cron',
  );

  // Shell
  const [shellCommand, setShellCommand] = useState(
    task?.config.type === 'shell' ? (task.config as any).shell.command : '',
  );

  // Command (flag-based)
  const [cmdBase, setCmdBase] = useState(
    task?.config.type === 'command' ? (task.config as any).command.base : '',
  );
  const [cmdParams, setCmdParams] = useState<{ flag: string; value: string }[]>(
    task?.config.type === 'command'
      ? (task.config as any).command.params.map((p: any) => ({ flag: p.flag, value: p.value }))
      : [{ flag: '', value: '' }],
  );

  // Language
  const [language, setLanguage] = useState<LanguageRuntime>(
    task?.config.type === 'language' ? (task.config as any).language.language : 'javascript',
  );
  const [code, setCode] = useState(
    task?.config.type === 'language' ? (task.config as any).language.code : '',
  );

  // Cron
  const initialCron = task?.schedule.kind === 'cron' ? (task.schedule as any).expression : '*/5 * * * *';
  const [cronPreset, setCronPreset] = useState(
    cronPresets.find(p => p.value === initialCron)?.value ?? 'custom',
  );
  const [cronCustom, setCronCustom] = useState(initialCron);

  // Once
  const [onceDatetime, setOnceDatetime] = useState(
    task?.schedule.kind === 'once'
      ? task.schedule.executeAt.slice(0, 16)
      : new Date(Date.now() + 3600000).toISOString().slice(0, 16),
  );

  // Notification (per-task)
  const [notifySystem, setNotifySystem] = useState(task?.notifySystem ?? true);
  const [notifySystemOnFailureOnly, setNotifySystemOnFailureOnly] = useState(task?.notifySystemOnFailureOnly ?? false);
  const [notifyEmail, setNotifyEmail] = useState(!!task?.notifyEmailTo);
  const [notifyEmailTo, setNotifyEmailTo] = useState(task?.notifyEmailTo ?? '');
  const [notifyEmailOnFailureOnly, setNotifyEmailOnFailureOnly] = useState(task?.notifyEmailOnFailureOnly ?? false);
  const [notifyEmailTemplate, setNotifyEmailTemplate] = useState(task?.notifyEmailTemplate ??
    `Subject: [TriggerX]({{task.status}}) {{task.name}} - 第{{task.runCount}}次执行

` +
    `任务: {{task.name}}
状态: {{task.status}}
退出码: {{task.exitCode}}
耗时: {{task.duration}}ms
执行次数: {{task.runCount}}
执行时间: {{task.executedAt}}

--- STDOUT ---
{{task.stdout}}

--- STDERR ---
{{task.stderr}}`);


  // Test run
  const [testResult, setTestResult] = useState<TestRunResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  // REPL check
  const [runtimeCheck, setRuntimeCheck] = useState<RuntimeCheck | null>(null);
  const [checkingRuntime, setCheckingRuntime] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const isEditing = !!task;

  // ---- Helpers ----
  function buildSchedule(): Schedule {
    if (scheduleKind === 'once') {
      return { kind: 'once', executeAt: new Date(onceDatetime).toISOString() };
    }
    const expression = cronPreset === 'custom' ? cronCustom : cronPreset;
    const preset = cronPresets.find(p => p.value === expression);
    return { kind: 'cron', expression, label: preset?.label ?? expression };
  }

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
      schedule: buildSchedule(),
      lastRun: null,
      createdAt: task?.createdAt ?? now,
      updatedAt: now,
      notifySystem: notifySystem,
      notifySystemOnFailureOnly: notifySystemOnFailureOnly || undefined,
      notifyEmail: notifyEmail || undefined,
      notifyEmailTo: notifyEmailTo.trim() || undefined,
      notifyEmailOnFailureOnly: notifyEmailOnFailureOnly || undefined,
      notifyEmailTemplate: notifyEmailTemplate.trim() || undefined,
    };
  }

  function validate(): boolean {
    if (!name.trim()) { setError('请输入任务名称'); return false; }
    if (taskType === 'shell' && !shellCommand.trim()) { setError('请输入 Shell 命令'); return false; }
    if (taskType === 'command' && !cmdBase.trim()) { setError('请输入命令名称'); return false; }
    if (taskType === 'language' && !code.trim()) { setError('请输入代码'); return false; }
    return true;
  }

  async function handleTestRun() {
    setError(null);
    setTestResult(null);
    if (!validate()) return;
    setTesting(true);
    try {
      const tmp = buildTaskTmp();
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<TestRunResult>('test_run_task', { task: tmp });
      setTestResult(result);
      if (result.emailSent) {
        setEmailSent(true);
      } else if (result.emailError) {
        setEmailSent(true); // show the toast, but with error info
        // Append to test result display
      }
    } catch {
      setTestResult({
        exitCode: 0,
        stdout: `[mock] 命令: ${buildCommandStr(buildTaskTmp())}\n\n测试运行成功（模拟 — Tauri 后端未连接）`,
        stderr: '',
        durationMs: 42,
        error: null,
        emailSent: false,
        emailError: null,
      });
    } finally {
      setTesting(false);
    }
  }

  async function checkRuntimes() {
    setCheckingRuntime(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<RuntimeCheck>('check_runtimes');
      setRuntimeCheck(result);
    } catch {
      setRuntimeCheck({ javascript: true, python: true, rust: false, shell: true });
    } finally {
      setCheckingRuntime(false);
    }
  }

  async function handleSave() {
    setError(null);
    if (!validate()) return;
    const t = buildTaskTmp();
    if (isEditing) await updateTask(t);
    else await addTask(t);
    onSaved();
  }

  const runtimeUnavailable = taskType === 'language' && runtimeCheck && !runtimeCheck[language];

  return (
    <Dialog
      title={isEditing ? '编辑任务' : '新建任务'}
      onClose={onClose}
      aria-label={isEditing ? '编辑任务' : '新建任务'}
      width="80%"
    >
      <div style={{ padding: 16, maxHeight: '70vh', overflowY: 'auto' }}>
        {/* Error banner */}
        {error && (
          <div style={{
            padding: '8px 12px', marginBottom: 12, borderRadius: 6,
            backgroundColor: 'var(--bgColor-danger-emphasis, #cf222e)',
            color: '#fff', fontSize: 14,
          }}>
            {error}
          </div>
        )}

        {/* ===== 名称 ===== */}
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

        {/* ===== 类型 ===== */}
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 600, display: 'block', marginBottom: 4 }}>
            任务类型
          </span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(['shell', 'command', 'language'] as TaskType[]).map(t => (
              <Button
                key={t}
                variant={taskType === t ? 'primary' : 'default'}
                size="small"
                onClick={() => { setTaskType(t); setTestResult(null); }}
              >
                {{ shell: 'Shell 命令', command: '命令行工具', language: '代码片段' }[t]}
              </Button>
            ))}
          </div>
        </div>

        {/* ===== Shell ===== */}
        {taskType === 'shell' && (
          <div style={{ marginBottom: 16 }}>
            <FormControl>
              <FormControl.Label>Shell 命令</FormControl.Label>
              <Textarea
                value={shellCommand}
                onChange={e => setShellCommand(e.target.value)}
                placeholder="ls -la /tmp"
                rows={3}
                block
                autoCapitalize="none"
                autoCorrect="off"
              />
            </FormControl>
          </div>
        )}

        {/* ===== 命令行工具 ===== */}
        {taskType === 'command' && (
          <>
            <div style={{ marginBottom: 16 }}>
              <FormControl>
                <FormControl.Label>命令</FormControl.Label>
                <TextInput autoCapitalize="none" autoCorrect="off" 
                  value={cmdBase}
                  onChange={e => setCmdBase(e.target.value)}
                  placeholder="pg_dump"
                  block
                />
              </FormControl>
            </div>

            <div style={{ marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fgColor-muted, #656d76)' }}>
                参数
              </span>
            </div>

            {/* Header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 32px', gap: 8, marginBottom: 4,
              fontSize: 11, fontWeight: 600, color: 'var(--fgColor-muted, #656d76)', padding: '0 4px',
            }}>
              <span>选项（flag）</span>
              <span>值（value）</span>
              <span />
            </div>

            {cmdParams.map((p, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 32px', gap: 8, marginBottom: 6 }}>
                <TextInput autoCapitalize="none" autoCorrect="off" 
                  value={p.flag}
                  onChange={e => {
                    const next = [...cmdParams];
                    next[i] = { ...next[i], flag: e.target.value };
                    setCmdParams(next);
                  }}
                  placeholder="--host"
                  size="small"
                />
                <TextInput autoCapitalize="none" autoCorrect="off" 
                  value={p.value}
                  onChange={e => {
                    const next = [...cmdParams];
                    next[i] = { ...next[i], value: e.target.value };
                    setCmdParams(next);
                  }}
                  placeholder="localhost"
                  size="small"
                />
                <Button
                  size="small"
                  variant="invisible"
                  onClick={() => setCmdParams(cmdParams.filter((_, j) => j !== i))}
                  disabled={cmdParams.length <= 1}
                >
                  ✕
                </Button>
              </div>
            ))}

            <div style={{ marginBottom: 12 }}>
              <Button
                size="small"
                variant="invisible"
                onClick={() => setCmdParams([...cmdParams, { flag: '', value: '' }])}
              >
                + 添加参数
              </Button>
            </div>

            {/* Preview */}
            {cmdBase.trim() && (
              <div style={{
                padding: '8px 12px', marginBottom: 12, borderRadius: 6,
                backgroundColor: 'var(--bgColor-muted, #f6f8fa)',
                fontSize: 12, fontFamily: 'monospace',
                color: 'var(--fgColor-muted, #656d76)',
              }}>
                <span style={{ fontWeight: 600, color: 'var(--fgColor-default)' }}>$</span>{' '}
                {cmdBase}{' '}
                {cmdParams.filter(p => p.flag.trim()).map((p, i) => (
                  <span key={i}>
                    <span style={{ color: 'var(--fgColor-accent, #0969da)' }}>{p.flag}</span>
                    {p.value && <span> <span style={{ color: 'var(--fgColor-success, #1a7f37)' }}>{p.value}</span></span>}{' '}
                  </span>
                ))}
              </div>
            )}
          </>
        )}

        {/* ===== 代码片段 ===== */}
        {taskType === 'language' && (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <FormControl>
                  <FormControl.Label>语言</FormControl.Label>
                  <Select
                    value={language}
                    onChange={e => {
                      setLanguage(e.target.value as LanguageRuntime);
                      setTestResult(null);
                    }}
                  >
                    {languageOptions.map(opt => (
                      <Select.Option key={opt.value} value={opt.value}>
                        {opt.label}
                      </Select.Option>
                    ))}
                  </Select>
                </FormControl>
              </div>
              <Button
                size="small"
                variant="invisible"
                onClick={checkRuntimes}
                disabled={checkingRuntime}
              >
                {checkingRuntime ? '检测中…' : '检测环境'}
              </Button>
            </div>

            {runtimeCheck && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {languageOptions.map(opt => (
                  <Label
                    key={opt.value}
                    variant={runtimeCheck[opt.value] ? 'success' : 'danger'}
                    size="small"
                  >
                    {opt.label}: {runtimeCheck[opt.value] ? '✓' : '✗'}
                  </Label>
                ))}
              </div>
            )}

            {runtimeUnavailable && (
              <div style={{
                padding: '8px 12px', marginBottom: 12, borderRadius: 6,
                backgroundColor: 'var(--bgColor-attention-muted, #fff8c5)',
                color: 'var(--fgColor-attention, #9a6700)', fontSize: 13,
              }}>
                当前环境下 <strong>{language}</strong> 的运行时不可用，执行可能会失败
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <FormControl>
                <FormControl.Label>代码</FormControl.Label>
                <Textarea
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder="// 在此编写代码"
                  rows={8}
                  block
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </FormControl>
            </div>
          </>
        )}

        {/* ===== 调度 ===== */}
        <hr style={{ border: 'none', borderTop: '1px solid var(--borderColor-muted, #d0d7de)', margin: '16px 0' }} />

        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 600, display: 'block', marginBottom: 8 }}>
            调度方式
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant={scheduleKind === 'cron' ? 'primary' : 'default'}
              size="small"
              onClick={() => setScheduleKind('cron')}
            >
              周期性 (Cron)
            </Button>
            <Button
              variant={scheduleKind === 'once' ? 'primary' : 'default'}
              size="small"
              onClick={() => setScheduleKind('once')}
            >
              一次性
            </Button>
          </div>
        </div>

        {scheduleKind === 'cron' ? (
          <>
            <div style={{ marginBottom: 16 }}>
              <FormControl>
                <FormControl.Label>常用周期</FormControl.Label>
                <Select value={cronPreset} onChange={e => setCronPreset(e.target.value)}>
                  {cronPresets.map(p => (
                    <Select.Option key={p.value} value={p.value}>{p.label}</Select.Option>
                  ))}
                </Select>
              </FormControl>
            </div>
            {cronPreset === 'custom' && (
              <div style={{ marginBottom: 16 }}>
                <FormControl>
                  <FormControl.Label>Cron 表达式</FormControl.Label>
                  <TextInput autoCapitalize="none" autoCorrect="off" 
                    value={cronCustom}
                    onChange={e => setCronCustom(e.target.value)}
                    placeholder="*/5 * * * *"
                    block
                  />
                </FormControl>
                <span style={{ fontSize: 12, color: 'var(--fgColor-muted, #656d76)' }}>
                  分 时 日 月 周 · 例: <code>0 9 * * 1</code> = 每周一 9:00
                </span>
              </div>
            )}
          </>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <FormControl>
              <FormControl.Label>执行时间</FormControl.Label>
              <TextInput autoCapitalize="none" autoCorrect="off" 
                type="datetime-local"
                value={onceDatetime}
                onChange={e => setOnceDatetime(e.target.value)}
                block
              />
            </FormControl>
          </div>
        )}

        {/* ===== 通知 ===== */}
        <hr style={{ border: 'none', borderTop: '1px solid var(--borderColor-muted, #d0d7de)', margin: '16px 0' }} />

        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 600, display: 'block', marginBottom: 8 }}>
            通知
          </span>

          {/* System notification */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span id="notify-sys-label" style={{ fontSize: 14 }}>系统通知</span>
            <ToggleSwitch
              aria-labelledby="notify-sys-label"
              checked={notifySystem}
              onClick={() => setNotifySystem(!notifySystem)}
              size="small"
            />
          </div>

          {notifySystem && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, marginLeft: 28 }}>
              <span id="notify-sys-fail" style={{ fontSize: 13, color: 'var(--fgColor-muted, #656d76)' }}>仅失败时通知</span>
              <ToggleSwitch
                aria-labelledby="notify-sys-fail"
                checked={notifySystemOnFailureOnly}
                onClick={() => setNotifySystemOnFailureOnly(!notifySystemOnFailureOnly)}
                size="small"
              />
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span id="notify-email-label" style={{ fontSize: 14 }}>邮件通知</span>
            <ToggleSwitch
              aria-labelledby="notify-email-label"
              checked={notifyEmail}
              onClick={smtpConfigured ? () => setNotifyEmail(!notifyEmail) : undefined}
              disabled={!smtpConfigured}
              size="small"
            />
            {!smtpConfigured && (
              <span style={{ fontSize: 12, color: 'var(--fgColor-muted, #656d76)' }}>
                — 需先在设置中配置 SMTP
              </span>
            )}
          </div>

          {notifyEmail && (
            <div style={{ marginLeft: 28, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span id="notify-email-fail" style={{ fontSize: 13, color: 'var(--fgColor-muted, #656d76)' }}>仅失败时通知</span>
                <ToggleSwitch
                  aria-labelledby="notify-email-fail"
                  checked={notifyEmailOnFailureOnly}
                  onClick={() => setNotifyEmailOnFailureOnly(!notifyEmailOnFailureOnly)}
                  size="small"
                />
              </div>
              <FormControl>
                <FormControl.Label>收件地址</FormControl.Label>
                <TextInput autoCapitalize="none" autoCorrect="off" 
                  value={notifyEmailTo}
                  onChange={e => setNotifyEmailTo(e.target.value)}
                  placeholder="me@example.com; others@example.com"
                  block
                  size="small"
                />
              </FormControl>
              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fgColor-muted, #656d76)', display: 'block', marginBottom: 4 }}>
                  邮件内容
                </span>
                <Textarea
                  value={notifyEmailTemplate}
                  onChange={e => setNotifyEmailTemplate(e.target.value)}
                  rows={10}
                  block
                  autoCapitalize="none"
                  autoCorrect="off"
                />
                <div style={{ fontSize: 11, color: 'var(--fgColor-muted, #656d76)', display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 4 }}>
                  <span><code style={{ background: 'var(--bgColor-muted,#f6f8fa)', padding: '1px 4px', borderRadius: 3 }}>{'{{task.name}}'}</code> 任务名</span>
                  <span><code style={{ background: 'var(--bgColor-muted,#f6f8fa)', padding: '1px 4px', borderRadius: 3 }}>{'{{task.status}}'}</code> 状态</span>
                  <span><code style={{ background: 'var(--bgColor-muted,#f6f8fa)', padding: '1px 4px', borderRadius: 3 }}>{'{{task.exitCode}}'}</code> 退出码</span>
                  <span><code style={{ background: 'var(--bgColor-muted,#f6f8fa)', padding: '1px 4px', borderRadius: 3 }}>{'{{task.duration}}'}</code> 耗时</span>
                  <span><code style={{ background: 'var(--bgColor-muted,#f6f8fa)', padding: '1px 4px', borderRadius: 3 }}>{'{{task.executedAt}}'}</code> 执行时间</span>
                  <span><code style={{ background: 'var(--bgColor-muted,#f6f8fa)', padding: '1px 4px', borderRadius: 3 }}>{'{{task.stdout}}'}</code> 输出</span>
                  <span><code style={{ background: 'var(--bgColor-muted,#f6f8fa)', padding: '1px 4px', borderRadius: 3 }}>{'{{task.stderr}}'}</code> 错误</span>
                  <span><code style={{ background: 'var(--bgColor-muted,#f6f8fa)', padding: '1px 4px', borderRadius: 3 }}>{'{{!date}}'}</code> 当前日期</span>
                  <span><code style={{ background: 'var(--bgColor-muted,#f6f8fa)', padding: '1px 4px', borderRadius: 3 }}>{'{{!time}}'}</code> 当前时间</span>
                  <span><code style={{ background: 'var(--bgColor-muted,#f6f8fa)', padding: '1px 4px', borderRadius: 3 }}>{'{{!datetime}}'}</code> 日期时间</span>
                  <span><code style={{ background: 'var(--bgColor-muted,#f6f8fa)', padding: '1px 4px', borderRadius: 3 }}>{'{{!sh cmd}}'}</code> Shell展开</span>
                  <span><code style={{ background: 'var(--bgColor-muted,#f6f8fa)', padding: '1px 4px', borderRadius: 3 }}>{'{{file:path}}'}</code> 引用文件</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ===== 测试运行 ===== */}
        <hr style={{ border: 'none', borderTop: '1px solid var(--borderColor-muted, #d0d7de)', margin: '16px 0' }} />

        <Button
          leadingVisual={PlayIcon}
          onClick={handleTestRun}
          disabled={testing}
          size="small"
        >
          {testing ? '运行中…' : '测试运行'}
        </Button>

        {emailSent && (
          <div style={{
            marginTop: 12, padding: '8px 12px', borderRadius: 6, fontSize: 13,
            backgroundColor: 'var(--bgColor-success-muted, #dafbe1)',
            color: 'var(--fgColor-success, #1a7f37)',
          }}>
            测试邮件已发送至 {notifyEmailTo}
          </div>
        )}

        {testResult && (
          <div style={{ marginTop: 12, borderRadius: 6, border: '1px solid var(--borderColor-muted, #d0d7de)', overflow: 'hidden' }}>
            {/* Status */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 12px',
              backgroundColor: testResult.exitCode === 0
                ? 'var(--bgColor-success-muted, #dafbe1)'
                : 'var(--bgColor-danger-muted, #ffebe9)',
              fontSize: 12, fontWeight: 600,
            }}>
              <span style={{ color: testResult.exitCode === 0 ? 'var(--fgColor-success, #1a7f37)' : 'var(--fgColor-danger, #cf222e)' }}>
                {testResult.exitCode === 0 ? <CheckIcon size={14} /> : <XIcon size={14} />}
              </span>
              <span>{testResult.exitCode === 0 ? '成功' : `失败 (exit ${testResult.exitCode})`}</span>
              <span style={{ color: 'var(--fgColor-muted)', fontWeight: 400 }}>· {testResult.durationMs}ms</span>
              {testResult.error && (
                <span style={{ color: 'var(--fgColor-danger, #cf222e)', fontWeight: 400 }}>· {testResult.error}</span>
              )}
            </div>

            {testResult.stdout && (
              <pre style={{
                margin: 0, padding: '8px 12px',
                fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                maxHeight: 160, overflow: 'auto',
                borderTop: '1px solid var(--borderColor-muted, #d0d7de)',
              }}>
                {testResult.stdout}
              </pre>
            )}

            {testResult.stderr && (
              <pre style={{
                margin: 0, padding: '8px 12px',
                fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                maxHeight: 120, overflow: 'auto',
                borderTop: '1px solid var(--borderColor-muted, #d0d7de)',
                backgroundColor: 'var(--bgColor-danger-muted, #ffebe9)',
                color: 'var(--fgColor-danger, #cf222e)',
              }}>
                {testResult.stderr}
              </pre>
            )}
          </div>
        )}
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
