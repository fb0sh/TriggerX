import { useState, useEffect } from 'react';
import { Dialog, TextInput, FormControl, Textarea, Button, ToggleSwitch } from '@primer/react';
import { Cron } from 'react-js-cron';
import 'react-js-cron/styles.css';
import { getNextCronTimes } from '../cron-utils';
import { PlayIcon, CheckIcon, XIcon } from '@primer/octicons-react';
import { CommandForm } from './CommandForm';
import { LanguageForm } from './LanguageForm';
import { ShellForm } from './ShellForm';
import { useAppStore } from '../store';
import type { Task, TaskType, Schedule, LanguageRuntime, TestRunResult } from '../types';

interface Props {
  task: Task | null;
  smtpConfigured?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const cronLocale = {
  everyText: '每',
  emptyMonths: '每月',
  emptyMonthDays: '每日',
  emptyMonthDaysShort: '每日',
  emptyWeekDays: '每周',
  emptyWeekDaysShort: '每周',
  emptyHours: '每小时',
  emptyMinutes: '每分钟',
  emptyMinutesForHourPeriod: '每',
  yearOption: '每年',
  monthOption: '每月',
  weekOption: '每周',
  dayOption: '每天',
  hourOption: '每小时',
  minuteOption: '每分钟',
  rebootOption: '重启',
  prefixPeriod: '',
  prefixMonths: '',
  prefixMonthDays: '',
  prefixWeekDays: '',
  prefixWeekDaysForMonthAndYearPeriod: '',
  prefixHours: '',
  prefixMinutes: '',
  prefixMinutesForHourPeriod: '',
  suffixMinutesForHourPeriod: '',
  errorInvalidCron: '无效的 Cron 表达式',
  clearButtonText: '清除',
  weekDays: ['日', '一', '二', '三', '四', '五', '六'],
  months: ['1 月', '2 月', '3 月', '4 月', '5 月', '6 月', '7 月', '8 月', '9 月', '10 月', '11 月', '12 月'],
  altWeekDays: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
  altMonths: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
};

/** Describe a cron expression in Chinese. */
function describeCron(exp: string): string {
  const p = exp.trim().split(/\s+/);
  if (p.length !== 5) return '';
  const [mi, h, dom, mon, dow] = p;
  const num = (s: string) => /^\d+$/.test(s);
  const pad = (s: string) => s.padStart(2, '0');

  if (mi === '*' && h === '*' && dom === '*' && mon === '*' && dow === '*') return '每分钟执行';

  const miInt = mi.match(/^\*\/(\d+)$/);
  if (miInt && h === '*' && dom === '*' && mon === '*' && dow === '*') return `每 ${miInt[1]} 分钟执行`;

  if (num(mi) && h === '*' && dom === '*' && mon === '*' && dow === '*') return `每小时 ${pad(mi)} 分执行`;

  const hInt = h.match(/^\*\/(\d+)$/);
  if (mi === '0' && hInt && dom === '*' && mon === '*' && dow === '*') return `每 ${hInt[1]} 小时执行`;

  if (mi === '0' && num(h) && dom === '*' && mon === '*') {
    if (dow === '*') return `每天 ${pad(h)}:00`;
    if (dow === '1-5') return `工作日 ${pad(h)}:00`;
    if (dow === '0,6' || dow === '6,0') return `周末 ${pad(h)}:00`;
    if (num(dow)) {
      const names = ['日', '一', '二', '三', '四', '五', '六'];
      const d = parseInt(dow);
      if (d >= 0 && d <= 6) return `每周${names[d]} ${pad(h)}:00`;
    }
  }

  if (mi === '0' && h === '0' && num(dom) && mon === '*' && dow === '*') return `每月 ${dom} 号 00:00`;

  return `Cron: ${exp}`;
}

/** Show cron description + next 5 execution times. */
function CronPreview({ expression }: { expression: string }) {
  const [times, setTimes] = useState<{ iso: string; display: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!expression.trim()) return;
    let cancelled = false;
    setLoading(true);
    getNextCronTimes(expression, 5).then(t => { if (!cancelled) setTimes(t); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [expression]);

  return (
    <div style={{ fontSize: 13, color: 'var(--fgColor-muted, #656d76)', marginBottom: 12, padding: '6px 10px', background: 'var(--bgColor-muted, #f6f8fa)', borderRadius: 6 }}>
      <div style={{ marginBottom: times.length > 0 ? 6 : 0 }}>{describeCron(expression)}</div>
      {loading && <div style={{ fontSize: 11 }}>计算中...</div>}
      {!loading && times.length > 0 && (
        <div style={{ fontSize: 11, lineHeight: 1.8 }}>
          <span style={{ fontWeight: 600 }}>近 5 次执行:</span>
          {times.map((t, i) => (
            <div key={i} style={{ paddingLeft: 12 }}>{t.display}</div>
          ))}
        </div>
      )}
    </div>
  );
}

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
  const [cronValue, setCronValue] = useState(
    task?.schedule.kind === 'cron' ? (task.schedule as any).expression : '*/5 * * * *',
  );

  // Once
  const [onceDatetime, setOnceDatetime] = useState(
    task?.schedule.kind === 'once'
      ? task.schedule.executeAt.slice(0, 16)
      : new Date(Date.now() + 3600000).toISOString().slice(0, 16),
  );

  // Notification (per-task)
  const [notifySystem, setNotifySystem] = useState(task?.notify?.system ?? true);
  const [notifySystemOnFailureOnly, setNotifySystemOnFailureOnly] = useState(task?.notify?.systemOnFailureOnly ?? false);
  const [notifyEmail, setNotifyEmail] = useState(!!task?.notify?.emailTo);
  const [notifyEmailTo, setNotifyEmailTo] = useState(task?.notify?.emailTo ?? '');
  const [notifyEmailOnFailureOnly, setNotifyEmailOnFailureOnly] = useState(task?.notify?.emailOnFailureOnly ?? false);
  const [notifyEmailTemplate, setNotifyEmailTemplate] = useState(task?.notify?.emailTemplate ??
    `Subject: [TriggerX] {{task.name}} {{task.statusText}} (#{{task.runCount}})

` +
    `任务: {{task.name}}
状态: {{task.statusText}}
退出码: {{task.exitCode}}
耗时: {{task.duration}}ms
执行次数: {{task.runCount}}
执行时间: {{task.executedAtLocal}}

--- STDOUT ---
{{task.stdout}}

--- STDERR ---
{{task.stderr}}`);


  // Test run
  const [testResult, setTestResult] = useState<TestRunResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  // REPL check


  const [error, setError] = useState<string | null>(null);
  const isEditing = !!task;

  // ---- Helpers ----
  function buildSchedule(): Schedule {
    if (scheduleKind === 'once') {
      return { kind: 'once', executeAt: new Date(onceDatetime).toISOString() };
    }
    return { kind: 'cron', expression: cronValue, label: cronValue };
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
      runCount: task?.runCount ?? 0,
      createdAt: task?.createdAt ?? now,
      updatedAt: now,
      notify: {
        system: notifySystem,
        systemOnFailureOnly: notifySystemOnFailureOnly || undefined,
        email: notifyEmail || undefined,
        emailTo: notifyEmailTo.trim() || undefined,
        emailOnFailureOnly: notifyEmailOnFailureOnly || undefined,
        emailTemplate: notifyEmailTemplate.trim() || undefined,
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
            <ShellForm value={{ command: shellCommand }} onChange={v => setShellCommand(v.command)} />
          </div>
        )}

        {/* ===== 命令行工具 ===== */}
        {taskType === 'command' && (
          <div style={{ marginBottom: 16 }}>
            <CommandForm
              value={{ base: cmdBase, params: cmdParams }}
              onChange={v => { setCmdBase(v.base); setCmdParams(v.params); }}
            />
          </div>
        )}

        {/* ===== 代码片段 ===== */}
        {taskType === 'language' && (
          <div style={{ marginBottom: 16 }}>
            <LanguageForm
              value={{ language, code }}
              onChange={(v: { language: string; code: string }) => { setLanguage(v.language as any); setCode(v.code); setTestResult(null); }}
            />
          </div>
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
          <div>
            <div style={{ marginBottom: 8 }}>
              <Cron
                value={cronValue}
                setValue={setCronValue}
                locale={cronLocale}
                allowedPeriods={['year', 'month', 'week', 'day', 'hour', 'minute']}
                humanizeLabels={false}
                humanizeValue={false}
                leadingZero
                clearButton={false}
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <FormControl>
                <FormControl.Label>Cron 表达式</FormControl.Label>
                <TextInput
                  value={cronValue}
                  onChange={e => setCronValue(e.target.value)}
                  placeholder="*/5 * * * *"
                  block
                  autoCapitalize="none"
                  autoCorrect="off"
                  size="small"
                />
              </FormControl>
            </div>
            <CronPreview expression={cronValue} />
          </div>
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
