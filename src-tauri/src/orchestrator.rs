use crate::db::{Database, RunResult};

/// Build a RunResult from execution outputs.
pub fn build_run_result(code: i32, stdout: String, stderr: String, duration_ms: i64) -> RunResult {
    use chrono::Utc;
    let now = Utc::now();

    RunResult {
        status: if code == 0 { "success".into() } else { "failure".into() },
        exit_code: Some(code),
        stdout,
        stderr,
        executed_at: now.to_rfc3339(),
        duration_ms: Some(duration_ms),
        error: if code != 0 { Some("Exit code non-zero".into()) } else { None },
    }
}

/// Send email notification if configured.
pub fn send_email_notification(
    task: &crate::db::Task,
    result: &RunResult,
    db: &Database,
) -> Result<(), String> {
    let fail_only = task.notify_email_on_failure_only().unwrap_or(false);
    if fail_only && result.exit_code.unwrap_or(0) == 0 {
        return Ok(());
    }
    let to = task.notify_email_to().ok_or("No email recipients")?;
    if to.is_empty() {
        return Err("No email recipients".into());
    }
    let settings = db.get_settings().map_err(|e| format!("Failed to read settings: {e}"))?;
    let smtp = settings.smtp.ok_or("SMTP not configured")?;
    use crate::mailer;
    mailer::send_email(&smtp, to, task, result, Some(db))
}

/// Persist execution result, insert log, and send notifications.
/// Shared by tick(), run_now(), and test_run_task.
pub fn persist_and_notify(
    task: &crate::db::Task,
    code: i32,
    stdout: String,
    stderr: String,
    duration_ms: i64,
    trigger: &str,
    db: &Database,
    app: Option<&tauri::AppHandle>,
) -> Result<RunResult, String> {
    let run_result = build_run_result(code, stdout, stderr, duration_ms);

    // Persist result
    let mut updated = task.clone();
    updated.run_count += 1;
    updated.last_run = Some(serde_json::to_value(&run_result).unwrap_or_default());
    updated.updated_at = run_result.executed_at.clone();
    db.update_task(&updated)?;

    // Insert log
    let _ = db.insert_log(
        &task.id, &run_result.status, run_result.exit_code,
        &run_result.stdout, &run_result.stderr,
        &run_result.executed_at, run_result.duration_ms,
        run_result.error.as_deref(), trigger, updated.run_count);

    // System notification (requires AppHandle, skip in test mode)
    if let Some(app) = app {
        if task.notify_system().unwrap_or(true) {
            let fail_only = task.notify_system_on_failure_only().unwrap_or(false);
            if !fail_only || code != 0 {
                use crate::notifier;
                let _ = notifier::send_notification(app, task, &run_result);
            }
        }
    }

    // Email notification
    if task.notify_email().unwrap_or(false) {
        let _ = send_email_notification(task, &run_result, db);
    }

    Ok(run_result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Task;
    use serde_json::json;

    use std::sync::atomic::{AtomicU64, Ordering};
    static ORCH_COUNTER: AtomicU64 = AtomicU64::new(0);

    fn test_db() -> Database {
        let id = ORCH_COUNTER.fetch_add(1, Ordering::Relaxed);
        let path = format!("/tmp/triggerx_orch_test_{id}.db");
        let _ = std::fs::remove_file(&path);
        Database::new(&path).unwrap()
    }

    fn make_task(id: &str) -> Task {
        Task {
            id: id.into(),
            name: "test".into(),
            enabled: true,
            config: json!({"type": "shell", "shell": {"command": "echo ok"}}),
            schedule: json!({"kind": "cron"}),
            last_run: None,
            created_at: "2026-01-01T00:00:00Z".into(),
            updated_at: "2026-01-01T00:00:00Z".into(),
            run_count: 0,
            notify: json!({"system": true}),
        }
    }

    #[test]
    fn test_build_run_result_success() {
        let r = build_run_result(0, "out".into(), String::new(), 100);
        assert_eq!(r.status, "success");
        assert_eq!(r.exit_code, Some(0));
        assert_eq!(r.stdout, "out");
        assert!(r.error.is_none());
    }

    #[test]
    fn test_build_run_result_failure() {
        let r = build_run_result(1, String::new(), "err".into(), 50);
        assert_eq!(r.status, "failure");
        assert_eq!(r.exit_code, Some(1));
        assert!(r.error.is_some());
    }

    #[test]
    fn test_persist_and_notify_persists() {
        let db = test_db();
        let task = make_task("persist-test");
        db.add_task(&task).unwrap();

        let r = persist_and_notify(&task, 0, "ok".into(), String::new(), 100, "manual", &db, None).unwrap();
        assert_eq!(r.status, "success");

        let updated = db.get_task("persist-test").unwrap().unwrap();
        assert_eq!(updated.run_count, 1);
        assert!(updated.last_run.is_some());
    }

    #[test]
    fn test_send_email_notification_no_recipients() {
        let db = test_db();
        let mut task = make_task("no-email");
        task.notify = json!({"system": true});
        let r = build_run_result(0, String::new(), String::new(), 0);
        assert!(send_email_notification(&task, &r, &db).is_err());
    }
}
