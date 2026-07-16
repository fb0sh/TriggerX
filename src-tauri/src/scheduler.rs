use crate::db::Database;
use chrono::Utc;
use std::sync::Arc;
use tauri::AppHandle;

/// Start the scheduler background loop.
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

        if crate::engine::is_once_schedule(&task.schedule) {
            db.update_task_enabled(&task.id, false)?;
        }

        crate::executor::persist_and_notify(task, code, stdout, stderr, duration, "scheduled", db, app)?;
    }
    Ok(())
}
