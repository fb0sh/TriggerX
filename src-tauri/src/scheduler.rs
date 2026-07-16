use crate::db::{Database, RunResult};
use chrono::Utc;
use std::sync::Arc;
use tauri::AppHandle;

/// Start the scheduler background loop.
/// Every 15 seconds, checks enabled tasks and runs any that are due.
pub fn start_scheduler(db: Arc<Database>, app: AppHandle) {
    std::thread::spawn(move || {
        loop {
            if let Err(e) = tick(&db, &app) {
                eprintln!("[triggerx] Scheduler tick error: {e}");
            }
            std::thread::sleep(std::time::Duration::from_secs(15));
        }
    });
}

fn tick(db: &Database, app: &AppHandle) -> Result<(), String> {
    let tasks = db.get_enabled_tasks()?;
    let now = Utc::now();

    for task in &tasks {
        if !crate::engine::should_run_now(task, &now)? {
            continue;
        }

        eprintln!("[triggerx] Running task: {}", task.name);
        let start = std::time::Instant::now();
        let (code, stdout, stderr) = crate::executor::execute_task(task);
        let duration = start.elapsed().as_millis() as i64;

        let run_result = RunResult {
            status: if code == 0 { "success".into() } else { "failure".into() },
            exit_code: Some(code),
            stdout,
            stderr,
            executed_at: now.to_rfc3339(),
            duration_ms: Some(duration),
            error: if code != 0 { Some("Exit code non-zero".into()) } else { None },
        };

        let mut updated = task.clone();
        updated.run_count += 1;
        updated.last_run = Some(serde_json::to_value(&run_result).unwrap_or_default());
        updated.updated_at = Utc::now().to_rfc3339();

        if crate::engine::is_once_schedule(&task.schedule) {
            db.update_task_enabled(&task.id, false)?;
        }
        db.update_task(&updated)?;

        // Record execution log
        let _ = db.insert_log(
            &task.id, &run_result.status, run_result.exit_code,
            &run_result.stdout, &run_result.stderr,
            &run_result.executed_at, run_result.duration_ms,
            run_result.error.as_deref(), "scheduled");

        // System notification
        if task.notify_system.unwrap_or(true) {
            let sys_fail_only = task.notify_system_on_failure_only.unwrap_or(false);
            if !sys_fail_only || code != 0 {
                let _ = crate::notifier::send_notification(app, task, &run_result);
            }
        }

        // Email notification
        if task.notify_email.unwrap_or(false) {
            let email_fail_only = task.notify_email_on_failure_only.unwrap_or(false);
            if !email_fail_only || code != 0 {
                if let Some(ref to) = task.notify_email_to {
                    if !to.is_empty() {
                        if let Ok(settings) = db.get_settings() {
                            if let Some(ref smtp) = settings.smtp {
                                let _ = crate::mailer::send_email(smtp, to, task, &run_result);
                            }
                        }
                    }
                }
            }
        }
    }
    Ok(())
}
