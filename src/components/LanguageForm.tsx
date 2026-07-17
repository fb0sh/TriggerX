import { useState } from 'react';
import { FormControl, Select, Textarea, Button, Label } from '@primer/react';
import { checkRuntimes } from '../ipc';
import type { LanguageConfig, LanguageRuntime, RuntimeCheck } from '../types';

interface Props { value: LanguageConfig; onChange: (v: LanguageConfig) => void; }

const opts: { value: LanguageRuntime; label: string }[] = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'shell', label: 'Shell' },
  { value: 'rust', label: 'Rust' },
];

export function LanguageForm({ value, onChange }: Props) {
  const [runtimeCheck, setRuntimeCheck] = useState<RuntimeCheck | null>(null);
  const [checking, setChecking] = useState(false);

  async function handleCheckRuntimes() {
    setChecking(true);
    try {
      const r = await checkRuntimes();
      setRuntimeCheck(r);
    } catch { setRuntimeCheck({ javascript: true, python: true, rust: false, shell: true }); }
    finally { setChecking(false); }
  }

  const unavailable = runtimeCheck && !runtimeCheck[value.language];

  return (<>
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 12 }}>
      <FormControl><FormControl.Label>语言</FormControl.Label>
        <Select value={value.language} onChange={e => onChange({ ...value, language: e.target.value as LanguageRuntime })}>
          {opts.map(o => <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>)}
        </Select>
      </FormControl>
      <Button size="small" variant="invisible" onClick={handleCheckRuntimes} disabled={checking}>{checking ? '检测中…' : '检测环境'}</Button>
    </div>
    {runtimeCheck && (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {opts.map(o => <Label key={o.value} variant={runtimeCheck[o.value] ? 'success' : 'danger'} size="small">{o.label}: {runtimeCheck[o.value] ? '✓' : '✗'}</Label>)}
      </div>
    )}
    {unavailable && (
      <div style={{ padding: '8px 12px', marginBottom: 12, borderRadius: 6, backgroundColor: 'var(--bgColor-attention-muted, #fff8c5)', color: 'var(--fgColor-attention, #9a6700)', fontSize: 13 }}>
        当前环境下 <strong>{value.language}</strong> 的运行时不可用，执行可能会失败
      </div>
    )}
    <FormControl><FormControl.Label>代码</FormControl.Label>
      <Textarea value={value.code} onChange={e => onChange({ ...value, code: e.target.value })}
        placeholder="// 在此编写代码" rows={8} block autoCapitalize="none" autoCorrect="off" />
    </FormControl>
  </>);
}
