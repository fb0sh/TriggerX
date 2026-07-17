import { useCallback, useRef, useState } from 'react';
import { runNow, getTasks, listenTaskCompleted } from '../ipc';
import { useAppStore } from '../store';
import type { RunResult } from '../types';

interface RunCompletion {
  status: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  executedAt: string;
  durationMs: number;
  error: string | null;
}

export function useRunNow(onFlash: (msg: string) => void) {
  const [runningTasks, setRunningTasks] = useState<Set<string>>(new Set());
  // Map from taskId to startTime ISO string — fixes multi-task race condition
  const runningMapRef = useRef<Map<string, string>>(new Map());

  const updateRunning = useCallback((fn: (prev: Set<string>) => Set<string>) => {
    setRunningTasks(fn);
  }, []);

  // Listen for async task completion events from Tauri backend
  const setupListener = useCallback(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      unlisten = await listenTaskCompleted((r: RunCompletion) => {
        // Find which task completed by matching executedAt against our running map
        let matchedId: string | null = null;
        for (const [id, startTime] of runningMapRef.current) {
          if (new Date(r.executedAt).toISOString() > startTime) {
            matchedId = id;
            break;
          }
        }
        if (!matchedId) return;

        useAppStore.getState().updateTaskResult(matchedId, {
          status: r.status as RunResult['status'],
          exitCode: r.exitCode,
          stdout: r.stdout,
          stderr: r.stderr,
          executedAt: r.executedAt,
          durationMs: r.durationMs,
          error: r.error ?? undefined,
        });
        runningMapRef.current.delete(matchedId);
        updateRunning(prev => { const n = new Set(prev); n.delete(matchedId!); return n; });
        onFlash('执行完成');
      });
    })();
    return () => { unlisten?.(); };
  }, [updateRunning, onFlash]);

  const handleRunNow = useCallback(async (id: string, taskName: string) => {
    const startTime = new Date().toISOString();
    runningMapRef.current.set(id, startTime);
    updateRunning(prev => new Set(prev).add(id));

    try {
      await runNow(id);

      // Poll backend for result (background thread persists via DB)
      let attempts = 0;
      while (attempts < 120) {
        await new Promise(r => setTimeout(r, 500));
        attempts++;
        try {
          const allTasks = await getTasks();
          const updated = allTasks.find((t: any) => t.id === id);
          if (updated?.lastRun && new Date(updated.lastRun.executedAt).toISOString() > startTime) {
            useAppStore.getState().updateTaskResult(id, updated.lastRun);
            runningMapRef.current.delete(id);
            onFlash(`「${taskName}」执行完成`);
            break;
          }
        } catch { /* retry */ }
        if (attempts >= 120) {
          onFlash(`「${taskName}」执行超时`);
        }
      }
    } catch {
      onFlash(`「${taskName}」执行失败`);
    }
    runningMapRef.current.delete(id);
    updateRunning(prev => { const n = new Set(prev); n.delete(id); return n; });
  }, [updateRunning, onFlash]);

  return { runningTasks, setupListener, handleRunNow };
}
