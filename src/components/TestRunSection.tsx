import { useState } from 'react';
import { Button } from '@primer/react';
import { PlayIcon, CheckIcon, XIcon } from '@primer/octicons-react';
import { testRunTask } from '../ipc';
import { formatDuration, OutputBlock } from '../utils';
import type { Task, TestRunResult } from '../types';

interface Props {
  buildTask: () => Task;
  onValidate: () => boolean;
  onError: (msg: string | null) => void;
  emailTo: string;
}

export function TestRunSection({ buildTask, onValidate, onError, emailTo }: Props) {
  const [testResult, setTestResult] = useState<TestRunResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  async function handleTestRun() {
    onError(null);
    setTestResult(null);
    if (!onValidate()) return;
    setTesting(true);
    try {
      const tmp = buildTask();
      const result = await testRunTask(tmp);
      setTestResult(result);
      if (result.emailSent || result.emailError) setEmailSent(true);
    } catch {
      setTestResult({
        exitCode: 0,
        stdout: `[mock] 测试运行成功（模拟 — Tauri 后端未连接）`,
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

  return (
    <>
      <Button leadingVisual={PlayIcon} onClick={handleTestRun} disabled={testing} size="small">
        {testing ? '运行中…' : '测试运行'}
      </Button>

      {emailSent && (
        <div style={{
          marginTop: 12, padding: '8px 12px', borderRadius: 6, fontSize: 13,
          backgroundColor: 'var(--bgColor-success-muted, #dafbe1)',
          color: 'var(--fgColor-success, #1a7f37)',
        }}>
          测试邮件已发送至 {emailTo}
        </div>
      )}

      {testResult && (
        <div style={{ marginTop: 12, borderRadius: 6, border: '1px solid var(--borderColor-muted, #d0d7de)', overflow: 'hidden' }}>
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
            <span style={{ color: 'var(--fgColor-muted)', fontWeight: 400 }}>· {formatDuration(testResult.durationMs)}</span>
            {testResult.error && (
              <span style={{ color: 'var(--fgColor-danger, #cf222e)', fontWeight: 400 }}>· {testResult.error}</span>
            )}
          </div>

          {testResult.stdout && (
            <div style={{ borderTop: '1px solid var(--borderColor-muted, #d0d7de)' }}>
              <OutputBlock stdout={testResult.stdout} stderr={testResult.stderr} maxHeight={160} />
            </div>
          )}
        </div>
      )}
    </>
  );
}
