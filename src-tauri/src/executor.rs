use crate::db::{Database, RunResult};
use serde::Serialize;
use std::process::Command;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TestRunResult {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: i64,
    pub error: Option<String>,
    pub email_sent: bool,
    pub email_error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeCheck {
    pub javascript: bool,
    pub python: bool,
    pub rust: bool,
    pub shell: bool,
}

/// Run a task once (test mode) and return the result without persisting.
pub fn run_task_test(task: &crate::db::Task) -> TestRunResult {
    let start = std::time::Instant::now();
    let (code, stdout, stderr) = execute_task(task);
    let duration = start.elapsed().as_millis() as i64;

    TestRunResult {
        exit_code: code,
        stdout,
        stderr,
        duration_ms: duration,
        error: if code != 0 { Some("Exit code non-zero".into()) } else { None },
        email_sent: false,
        email_error: None,
    }
}

/// Persist execution result, insert log, and send notifications.
/// Shared by tick() and run_now() to eliminate code duplication.
pub fn persist_and_notify(
    task: &crate::db::Task,
    code: i32,
    stdout: String,
    stderr: String,
    duration_ms: i64,
    trigger: &str,
    db: &Database,
    app: &tauri::AppHandle,
) -> Result<RunResult, String> {
    use chrono::Utc;
    let now = Utc::now();

    let run_result = RunResult {
        status: if code == 0 { "success".into() } else { "failure".into() },
        exit_code: Some(code),
        stdout,
        stderr,
        executed_at: now.to_rfc3339(),
        duration_ms: Some(duration_ms),
        error: if code != 0 { Some("Exit code non-zero".into()) } else { None },
    };

    // Persist result
    let mut updated = task.clone();
    updated.run_count += 1;
    updated.last_run = Some(serde_json::to_value(&run_result).unwrap_or_default());
    updated.updated_at = now.to_rfc3339();
    db.update_task(&updated)?;

    // Insert log
    let _ = db.insert_log(
        &task.id, &run_result.status, run_result.exit_code,
        &run_result.stdout, &run_result.stderr,
        &run_result.executed_at, run_result.duration_ms,
        run_result.error.as_deref(), trigger);

    // System notification
    if task.notify_system().unwrap_or(true) {
        let fail_only = task.notify_system_on_failure_only().unwrap_or(false);
        if !fail_only || code != 0 {
            use crate::notifier;
            let _ = notifier::send_notification(app, task, &run_result);
        }
    }

    // Email notification
    if task.notify_email().unwrap_or(false) {
        let fail_only = task.notify_email_on_failure_only().unwrap_or(false);
        if !fail_only || code != 0 {
            if let Some(to) = task.notify_email_to() {
                if !to.is_empty() {
                    if let Ok(settings) = db.get_settings() {
                        if let Some(ref smtp) = settings.smtp {
                            use crate::mailer;
                            let _ = mailer::send_email(smtp, to, task, &run_result);
                        }
                    }
                }
            }
        }
    }

    Ok(run_result)
}

/// Check which language runtimes are available on this machine.
pub fn check_runtimes() -> RuntimeCheck {
    RuntimeCheck {
        javascript: which("node").is_some(),
        python: which("python3").is_some() || which("python").is_some(),
        rust: which("rustc").is_some(),
        shell: true,
    }
}

fn which(name: &str) -> Option<String> {
    let output = if cfg!(target_os = "windows") {
        Command::new("where").arg(name).output().ok()
    } else {
        Command::new("which").arg(name).output().ok()
    };
    output.and_then(|o| {
        if o.status.success() {
            String::from_utf8(o.stdout).ok().map(|s| s.trim().to_string())
        } else {
            None
        }
    })
}

pub fn execute_task(task: &crate::db::Task) -> (i32, String, String) {
    let config = &task.config;
    let task_type = config.get("type").and_then(|v| v.as_str()).unwrap_or("shell");

    match task_type {
        "shell" => {
            let command = config
                .pointer("/shell/command")
                .and_then(|v| v.as_str())
                .unwrap_or("echo 'no command'");
            execute_shell(command)
        }
        "command" => {
            let base = config
                .pointer("/command/base")
                .and_then(|v| v.as_str())
                .unwrap_or("");

            let params = config
                .pointer("/command/params")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter().filter_map(|p| {
                        let flag = p.get("flag").and_then(|v| v.as_str())?;
                        let value = p.get("value").and_then(|v| v.as_str()).unwrap_or("");
                        Some((flag.to_string(), value.to_string()))
                    }).collect::<Vec<_>>()
                })
                .unwrap_or_default();

            let mut parts = vec![base.to_string()];
            for (flag, value) in &params {
                parts.push(flag.clone());
                if !value.is_empty() {
                    parts.push(value.clone());
                }
            }
            let cmd_str = parts.join(" ");
            execute_shell(&cmd_str)
        }
        "language" => {
            let language = config
                .pointer("/language/language")
                .and_then(|v| v.as_str())
                .unwrap_or("javascript");
            let code = config
                .pointer("/language/code")
                .and_then(|v| v.as_str())
                .unwrap_or("");

            match language {
                "javascript" | "js" => execute_shell(&format!("node -e {}", sh_escape(code))),
                "python" | "py" => execute_shell(&format!("python3 -c {}", sh_escape(code))),
                "shell" | "sh" => execute_shell(&format!("sh -c {}", sh_escape(code))),
                "rust" | "rs" => {
                    let tmpdir = std::env::temp_dir();
                    let tmpfile = tmpdir.join("triggerx_runner.rs");
                    if let Err(e) = std::fs::write(&tmpfile, code) {
                        return (1, String::new(), format!("Failed to write temp file: {e}"));
                    }
                    let bin = tmpdir.join("triggerx_runner");
                    let compile = execute_shell(&format!("rustc {} -o {}", tmpfile.display(), bin.display()));
                    if compile.0 != 0 {
                        return compile;
                    }
                    execute_shell(&bin.to_string_lossy())
                }
                _ => (1, String::new(), format!("Unsupported language: {language}")),
            }
        }
        _ => (1, String::new(), format!("Unknown task type: {task_type}")),
    }
}

pub fn execute_shell(cmd: &str) -> (i32, String, String) {
    let output = if cfg!(target_os = "windows") {
        Command::new("cmd").args(["/C", cmd]).output()
    } else {
        Command::new("sh").args(["-c", cmd]).output()
    };

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            (out.status.code().unwrap_or(-1), stdout, stderr)
        }
        Err(e) => (-1, String::new(), format!("Execution error: {e}")),
    }
}

pub fn sh_escape(s: &str) -> String {
    let escaped = s.replace('\'', "'\\''");
    format!("'{escaped}'")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Task;
    use serde_json::json;

    fn make_task(name: &str, schedule_json: serde_json::Value) -> Task {
        Task {
            id: "test-id".into(),
            name: name.into(),
            enabled: true,
            config: json!({"type": "shell", "shell": {"command": "echo hello"}}),
            schedule: schedule_json,
            last_run: None,
            created_at: "2026-01-01T00:00:00Z".into(),
            updated_at: "2026-01-01T00:00:00Z".into(),
            run_count: 0,
            notify: json!({}),
        }
    }

    #[test]
    fn test_execute_shell_echo() {
        let (code, stdout, stderr) = execute_shell("echo hello");
        assert_eq!(code, 0);
        assert_eq!(stdout.trim(), "hello");
        assert!(stderr.is_empty());
    }

    #[test]
    fn test_execute_shell_exit_code() {
        let (code, _, _) = execute_shell("exit 42");
        assert_eq!(code, 42);
    }

    #[test]
    fn test_execute_shell_stderr() {
        let (code, _, stderr) = execute_shell("echo error >&2");
        assert_eq!(code, 0);
        assert_eq!(stderr.trim(), "error");
    }

    #[test]
    fn test_run_task_test_shell() {
        let task = make_task("test", json!({"kind": "cron"}));
        let result = run_task_test(&task);
        assert_eq!(result.exit_code, 0);
        assert_eq!(result.stdout.trim(), "hello");
        assert!(!result.email_sent);
        assert!(result.email_error.is_none());
    }

    #[test]
    fn test_run_task_test_duration_nonzero() {
        let task = make_task("test", json!({"kind": "cron"}));
        let result = run_task_test(&task);
        assert!(result.duration_ms > 0);
    }

    #[test]
    fn test_check_runtimes_shell_always_available() {
        let result = check_runtimes();
        assert!(result.shell);
    }

    #[test]
    fn test_sh_escape_simple() {
        assert_eq!(sh_escape("hello"), "'hello'");
    }

    #[test]
    fn test_sh_escape_with_single_quote() {
        let escaped = sh_escape("it's");
        assert!(escaped.starts_with("'"));
        assert!(escaped.ends_with("'"));
        assert_eq!(escaped, "'it'\\''s'");
    }

    #[test]
    fn test_sh_escape_empty() {
        assert_eq!(sh_escape(""), "''");
    }

    #[test]
    fn test_sh_escape_special_chars() {
        let escaped = sh_escape("a $PATH `cmd` \"quote\"");
        assert!(escaped.starts_with("'"));
        assert!(escaped.ends_with("'"));
    }
}
