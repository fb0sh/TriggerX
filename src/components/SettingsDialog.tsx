import { useEffect, useState } from 'react';
import { Dialog, TextInput, FormControl, Button, ToggleSwitch, Select } from '@primer/react';
import { useAppStore } from '../store';
import type { SmtpConfig } from '../types';

interface Props {
  onClose: () => void;
}

export function SettingsDialog({ onClose }: Props) {
  const { settings: s, saveSettings } = useAppStore();

  const [showSmtp, setShowSmtp] = useState(!!s.smtp);
  const [host, setHost] = useState(s.smtp?.host ?? '');
  const [port, setPort] = useState(String(s.smtp?.port ?? '587'));
  const [username, setUsername] = useState(s.smtp?.username ?? '');
  const [password, setPassword] = useState(s.smtp?.password ?? '');
  const [from, setFrom] = useState(s.smtp?.from ?? '');
  const [useTls, setUseTls] = useState(s.smtp?.useTls ?? 'auto');
  const [saved, setSaved] = useState(false);

  // Sync local state when loaded settings change
  useEffect(() => {
    setShowSmtp(!!s.smtp);
    setHost(s.smtp?.host ?? '');
    setPort(String(s.smtp?.port ?? '587'));
    setUsername(s.smtp?.username ?? '');
    setPassword(s.smtp?.password ?? '');
    setFrom(s.smtp?.from ?? '');
    setUseTls(s.smtp?.useTls ?? 'auto');
  }, [s.smtp]);

  async function handleSave() {
    const smtp: SmtpConfig | null = showSmtp
      ? { host, port: parseInt(port) || 587, username, password, from, useTls: useTls === 'auto' ? undefined : useTls }
      : null;

    await saveSettings({ smtp });
    setSaved(true);
    setTimeout(() => onClose(), 1000);
  }

  return (
    <Dialog title="设置" onClose={onClose} aria-label="设置">
      <div style={{ padding: 16 }}>
        {saved && (
          <div style={{
            padding: '8px 12px', marginBottom: 12, borderRadius: 6,
            backgroundColor: 'var(--bgColor-success-emphasis, #1a7f37)',
            color: '#fff', fontSize: 14,
          }}>
            已保存
          </div>
        )}

        {/* SMTP toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <span id="settings-smtp-label" style={{ fontSize: 14, fontWeight: 600 }}>
            SMTP 发件服务
          </span>
          <ToggleSwitch
            aria-labelledby="settings-smtp-label"
            checked={showSmtp}
            onClick={() => setShowSmtp(!showSmtp)}
            size="small"
          />
        </div>

        {showSmtp && (
          <>
            <div style={{ fontSize: 12, color: 'var(--fgColor-muted, #656d76)', marginBottom: 12 }}>
              配置发件服务器凭证。收件地址和通知规则在每个任务的设置中独立配置。
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 2 }}>
                <FormControl>
                  <FormControl.Label>SMTP 服务器</FormControl.Label>
                  <TextInput autoCapitalize="none" autoCorrect="off" value={host} onChange={e => setHost(e.target.value)} placeholder="smtp.gmail.com" size="small" />
                </FormControl>
              </div>
              <div style={{ flex: 1 }}>
                <FormControl>
                  <FormControl.Label>端口</FormControl.Label>
                  <TextInput autoCapitalize="none" autoCorrect="off" value={port} onChange={e => setPort(e.target.value)} placeholder="587" size="small" />
                </FormControl>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <FormControl>
                <FormControl.Label>用户名</FormControl.Label>
                <TextInput autoCapitalize="none" autoCorrect="off" value={username} onChange={e => setUsername(e.target.value)} placeholder="user@gmail.com" size="small" />
              </FormControl>
            </div>

            <div style={{ marginBottom: 12 }}>
              <FormControl>
                <FormControl.Label>密码</FormControl.Label>
                <TextInput autoCapitalize="none" autoCorrect="off" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" size="small" />
              </FormControl>
            </div>



            <div style={{ marginBottom: 12 }}>
              <FormControl>
                <FormControl.Label>发件地址 (From)</FormControl.Label>
                <TextInput autoCapitalize="none" autoCorrect="off" value={from} onChange={e => setFrom(e.target.value)} placeholder="triggerx@example.com" size="small" />
              </FormControl>
            </div>

            <div style={{ marginBottom: 12 }}>
              <FormControl>
                <FormControl.Label>TLS 加密方式</FormControl.Label>
                <Select value={useTls} onChange={e => setUseTls(e.target.value)}>
                  <Select.Option value="auto">自动（按端口：465=隐式TLS, 587=STARTTLS）</Select.Option>
                  <Select.Option value="implicit">隐式 TLS（465/587 都直接加密）</Select.Option>
                  <Select.Option value="starttls">STARTTLS（先明文后升级）</Select.Option>
                  <Select.Option value="none">无加密</Select.Option>
                </Select>
              </FormControl>
            </div>
          </>
        )}

        <div style={{ padding: '8px 0', fontSize: 12, color: 'var(--fgColor-muted, #656d76)' }}>
          通知方式：系统通知
          {showSmtp ? ' + SMTP 邮件' : '（邮件未配置 — 每个任务可单独设置收件地址）'}
        </div>
      </div>

      <div style={{
        display: 'flex', justifyContent: 'flex-end', gap: 8,
        padding: '12px 16px',
        borderTop: '1px solid var(--borderColor-muted, #d0d7de)',
      }}>
        <Button onClick={onClose} size="small">关闭</Button>
        <Button variant="primary" onClick={handleSave} size="small">保存</Button>
      </div>
    </Dialog>
  );
}
