import { FormControl, Select, TextInput, Button } from '@primer/react';
import type { Schedule } from '../types';

interface Props { value: Schedule; onChange: (v: Schedule) => void; }

const cronPresets = [
  { value: '*/5 * * * *', label: '每 5 分钟' }, { value: '*/15 * * * *', label: '每 15 分钟' },
  { value: '*/30 * * * *', label: '每 30 分钟' }, { value: '0 * * * *', label: '每小时' },
  { value: '0 */6 * * *', label: '每 6 小时' }, { value: '0 0 * * *', label: '每天凌晨' },
  { value: '0 9 * * *', label: '每天 9:00' }, { value: '0 0 * * 1', label: '每周一' },
  { value: '0 0 1 * *', label: '每月 1 号' }, { value: 'custom', label: '自定义 Cron' },
];

export function ScheduleForm({ value, onChange }: Props) {
  const isCron = value.kind === 'cron';
  const cronExp = isCron ? value.expression : '*/5 * * * *';
  const preset = cronPresets.find(p => p.value === cronExp)?.value ?? 'custom';

  return (<>
    <div style={{ marginBottom: 12 }}>
      <span style={{ fontSize: 14, fontWeight: 600, display: 'block', marginBottom: 8 }}>调度方式</span>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant={isCron ? 'primary' : 'default'} size="small" onClick={() => onChange({ kind: 'cron', expression: cronExp, label: cronPresets.find(p => p.value === cronExp)?.label || cronExp })}>周期性 (Cron)</Button>
        <Button variant={!isCron ? 'primary' : 'default'} size="small" onClick={() => onChange({ kind: 'once', executeAt: new Date(Date.now() + 3600000).toISOString() })}>一次性</Button>
      </div>
    </div>
    {isCron ? (
      <>
        <FormControl><FormControl.Label>常用周期</FormControl.Label>
          <Select value={preset} onChange={e => {
            if (e.target.value === 'custom') return;
            onChange({ kind: 'cron', expression: e.target.value, label: cronPresets.find(p => p.value === e.target.value)?.label || e.target.value });
          }}>
            {cronPresets.map(p => <Select.Option key={p.value} value={p.value}>{p.label}</Select.Option>)}
          </Select>
        </FormControl>
        {preset === 'custom' && (
          <div style={{ marginBottom: 16 }}>
            <FormControl><FormControl.Label>Cron 表达式</FormControl.Label>
              <TextInput value={cronExp} onChange={e => onChange({ kind: 'cron', expression: e.target.value, label: e.target.value })}
                placeholder="*/5 * * * *" block autoCapitalize="none" autoCorrect="off" />
            </FormControl>
            <span style={{ fontSize: 12, color: 'var(--fgColor-muted, #656d76)' }}>分 时 日 月 周 · 例: <code>0 9 * * 1</code> = 每周一 9:00</span>
          </div>
        )}
      </>
    ) : (
      <FormControl><FormControl.Label>执行时间</FormControl.Label>
        <TextInput type="datetime-local" value={value.executeAt.slice(0, 16)}
          onChange={e => onChange({ kind: 'once', executeAt: new Date(e.target.value).toISOString() })} block />
      </FormControl>
    )}
  </>);
}
