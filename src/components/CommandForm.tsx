import { FormControl, TextInput, Button } from '@primer/react';
import type { CommandConfig } from '../types';

interface Props { value: CommandConfig; onChange: (v: CommandConfig) => void; }

export function CommandForm({ value, onChange }: Props) {
  const params = value.params;
  const setParams = (p: typeof params) => onChange({ ...value, params: p });
  return (<>
    <FormControl><FormControl.Label>命令</FormControl.Label>
      <TextInput value={value.base} onChange={e => onChange({ ...value, base: e.target.value })}
        placeholder="pg_dump" block autoCapitalize="none" autoCorrect="off" />
    </FormControl>
    <div style={{ marginTop: 8, marginBottom: 4 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fgColor-muted, #656d76)' }}>参数</span>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 32px', gap: 8, marginBottom: 4, fontSize: 11, fontWeight: 600, color: 'var(--fgColor-muted, #656d76)', padding: '0 4px' }}>
      <span>选项 (flag)</span><span>值 (value)</span><span />
    </div>
    {params.map((p, i) => (
      <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 32px', gap: 8, marginBottom: 6 }}>
        <TextInput value={p.flag} onChange={e => { const n = [...params]; n[i] = { ...n[i], flag: e.target.value }; setParams(n); }}
          placeholder="--host" size="small" autoCapitalize="none" autoCorrect="off" />
        <TextInput value={p.value} onChange={e => { const n = [...params]; n[i] = { ...n[i], value: e.target.value }; setParams(n); }}
          placeholder="localhost" size="small" autoCapitalize="none" autoCorrect="off" />
        <Button size="small" variant="invisible" disabled={params.length <= 1}
          onClick={() => setParams(params.filter((_, j) => j !== i))}>✕</Button>
      </div>
    ))}
    <Button size="small" variant="invisible" onClick={() => setParams([...params, { flag: '', value: '' }])}>+ 添加参数</Button>
    {value.base.trim() && (
      <div style={{ padding: '8px 12px', marginTop: 8, borderRadius: 6, backgroundColor: 'var(--bgColor-muted, #f6f8fa)', fontSize: 12, fontFamily: 'monospace', color: 'var(--fgColor-muted, #656d76)' }}>
        <span style={{ fontWeight: 600, color: 'var(--fgColor-default)' }}>$</span> {value.base}{' '}
        {params.filter(p => p.flag.trim()).map((p, i) => (
          <span key={i}><span style={{ color: 'var(--fgColor-accent, #0969da)' }}>{p.flag}</span>{p.value && <span> <span style={{ color: 'var(--fgColor-success, #1a7f37)' }}>{p.value}</span></span>} </span>
        ))}
      </div>
    )}
  </>);
}
