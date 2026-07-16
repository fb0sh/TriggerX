import { FormControl, Textarea } from '@primer/react';
import type { ShellConfig } from '../types';

interface Props {
  value: ShellConfig;
  onChange: (v: ShellConfig) => void;
}

export function ShellForm({ value, onChange }: Props) {
  return (
    <FormControl>
      <FormControl.Label>Shell 命令</FormControl.Label>
      <Textarea
        value={value.command}
        onChange={e => onChange({ command: e.target.value })}
        placeholder="ls -la /tmp" rows={3} block
        autoCapitalize="none" autoCorrect="off"
      />
    </FormControl>
  );
}
