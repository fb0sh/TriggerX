import { TextInput, FormControl, Textarea, ToggleSwitch } from '@primer/react';

const DEFAULT_EMAIL_TEMPLATE =
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
{{task.stderr}}`;

export interface NotificationState {
  system: boolean;
  systemOnFailureOnly: boolean;
  email: boolean;
  emailTo: string;
  emailOnFailureOnly: boolean;
  emailTemplate: string;
}

interface Props {
  value: NotificationState;
  onChange: (v: NotificationState) => void;
  smtpConfigured: boolean;
}

export function NotificationSection({ value, onChange, smtpConfigured }: Props) {
  const update = (patch: Partial<NotificationState>) => onChange({ ...value, ...patch });

  return (
    <div style={{ marginBottom: 12 }}>
      <span style={{ fontSize: 14, fontWeight: 600, display: 'block', marginBottom: 8 }}>
        通知
      </span>

      {/* System notification */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span id="notify-sys-label" style={{ fontSize: 14 }}>系统通知</span>
        <ToggleSwitch
          aria-labelledby="notify-sys-label"
          checked={value.system}
          onClick={() => update({ system: !value.system })}
          size="small"
        />
      </div>

      {value.system && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, marginLeft: 28 }}>
          <span id="notify-sys-fail" style={{ fontSize: 13, color: 'var(--fgColor-muted, #656d76)' }}>仅失败时通知</span>
          <ToggleSwitch
            aria-labelledby="notify-sys-fail"
            checked={value.systemOnFailureOnly}
            onClick={() => update({ systemOnFailureOnly: !value.systemOnFailureOnly })}
            size="small"
          />
        </div>
      )}

      {/* Email notification */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span id="notify-email-label" style={{ fontSize: 14 }}>邮件通知</span>
        <ToggleSwitch
          aria-labelledby="notify-email-label"
          checked={value.email}
          onClick={smtpConfigured ? () => update({ email: !value.email }) : undefined}
          disabled={!smtpConfigured}
          size="small"
        />
        {!smtpConfigured && (
          <span style={{ fontSize: 12, color: 'var(--fgColor-muted, #656d76)' }}>
            — 需先在设置中配置 SMTP
          </span>
        )}
      </div>

      {value.email && (
        <div style={{ marginLeft: 28, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span id="notify-email-fail" style={{ fontSize: 13, color: 'var(--fgColor-muted, #656d76)' }}>仅失败时通知</span>
            <ToggleSwitch
              aria-labelledby="notify-email-fail"
              checked={value.emailOnFailureOnly}
              onClick={() => update({ emailOnFailureOnly: !value.emailOnFailureOnly })}
              size="small"
            />
          </div>
          <FormControl>
            <FormControl.Label>收件地址</FormControl.Label>
            <TextInput autoCapitalize="none" autoCorrect="off"
              value={value.emailTo}
              onChange={e => update({ emailTo: e.target.value })}
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
              value={value.emailTemplate}
              onChange={e => update({ emailTemplate: e.target.value })}
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
  );
}

export { DEFAULT_EMAIL_TEMPLATE };
