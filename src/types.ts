export type TaskType = 'command' | 'shell' | 'language';
export type ScheduleKind = 'cron' | 'once';
export type RunStatus = 'success' | 'failure' | 'running' | 'pending';

/** A single CLI flag + value pair */
export interface CommandParam {
  flag: string;
  value: string;
}

/** Command = base binary + flags */
export interface CommandConfig {
  base: string;
  params: CommandParam[];
}

export interface ShellConfig {
  command: string;
}

export type LanguageRuntime = 'javascript' | 'python' | 'rust' | 'shell';

export interface LanguageConfig {
  language: LanguageRuntime;
  code: string;
  runtimeAvailable?: boolean | null;
}

export type TaskConfig =
  | { type: 'command'; command: CommandConfig }
  | { type: 'shell'; shell: ShellConfig }
  | { type: 'language'; language: LanguageConfig };

export interface CronSchedule {
  kind: 'cron';
  expression: string;
  label: string;
}

export interface OnceSchedule {
  kind: 'once';
  executeAt: string;
}

export type Schedule = CronSchedule | OnceSchedule;

export interface RunResult {
  status: RunStatus;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  executedAt: string;
  durationMs: number | null;
  error?: string;
}

export interface Task {
  id: string;
  name: string;
  enabled: boolean;
  config: TaskConfig;
  schedule: Schedule;
  lastRun: RunResult | null;
  runCount?: number;
  createdAt: string;
  updatedAt: string;

  /** Per-task notification settings (JSON blob) */
  notify?: {
    system?: boolean;
    systemOnFailureOnly?: boolean;
    email?: boolean;
    emailTo?: string;
    emailOnFailureOnly?: boolean;
    emailTemplate?: string;
  };
}

/** Global SMTP credentials only — no recipient or content policies */
export interface SmtpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  from: string;
  /** TLS mode: 'auto' | 'implicit' | 'starttls' | 'none' */
  useTls?: string;
}

export interface AppSettings {
  smtp: SmtpConfig | null;
}

export interface TestRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  error: string | null;
  emailSent: boolean;
  emailError: string | null;
}

export interface ExecutionLog {
  id: number;
  taskId: string;
  status: RunStatus;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  executedAt: string;
  durationMs: number | null;
  error: string | null;
  trigger: string;  // "scheduled" | "manual"
  runCount: number;
}

export interface RuntimeCheck {
  javascript: boolean;
  python: boolean;
  rust: boolean;
  shell: boolean;
}
