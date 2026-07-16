mod db;
mod engine;
mod executor;
mod mailer;
mod notifier;
mod scheduler;
mod template;

use db::Database;
use std::sync::Arc;
use executor::TestRunResult;
use tauri::{
    menu::{MenuBuilder, PredefinedMenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};

// ---- Tauri Commands ----

#[tauri::command]
fn get_tasks(db: tauri::State<'_, Arc<Database>>) -> Result<Vec<db::Task>, String> {
    db.get_all_tasks()
}

#[tauri::command]
fn add_task(db: tauri::State<'_, Arc<Database>>, task: db::Task) -> Result<(), String> {
    db.add_task(&task)
}

#[tauri::command]
fn update_task(db: tauri::State<'_, Arc<Database>>, task: db::Task) -> Result<(), String> {
    db.update_task(&task)
}

#[tauri::command]
fn delete_task(db: tauri::State<'_, Arc<Database>>, id: String) -> Result<(), String> {
    db.delete_task(&id)
}

#[tauri::command]
fn toggle_task(db: tauri::State<'_, Arc<Database>>, id: String) -> Result<(), String> {
    let task = db.get_task(&id)?;
    match task {
        Some(t) => db.update_task_enabled(&id, !t.enabled),
        None => Err(format!("Task {id} not found")),
    }
}

#[tauri::command]
fn get_settings(db: tauri::State<'_, Arc<Database>>) -> Result<db::AppSettings, String> {
    db.get_settings()
}

#[tauri::command]
fn save_settings(db: tauri::State<'_, Arc<Database>>, settings: db::AppSettings) -> Result<(), String> {
    db.save_settings(&settings)
}

#[tauri::command]
fn test_run_task(task: db::Task, db: tauri::State<'_, Arc<Database>>) -> TestRunResult {
    let mut test_result = executor::run_task_test(&task);

    if let Some(to) = task.notify_email_to() {
        if !to.is_empty() {
            match db.get_settings() {
                Ok(settings) => match settings.smtp {
                    Some(ref smtp) => {
                        let run_result = db::RunResult {
                            status: if test_result.exit_code == 0 { "success".into() } else { "failure".into() },
                            exit_code: Some(test_result.exit_code),
                            stdout: test_result.stdout.clone(),
                            stderr: test_result.stderr.clone(),
                            executed_at: chrono::Utc::now().to_rfc3339(),
                            duration_ms: Some(test_result.duration_ms),
                            error: test_result.error.clone(),
                        };
                        match mailer::send_email(smtp, to, &task, &run_result, Some(db.inner())) {
                            Ok(()) => {
                                test_result.email_sent = true;
                                eprintln!("[triggerx] Test email sent to {to}");
                            }
                            Err(e) => {
                                test_result.email_error = Some(e.clone());
                                eprintln!("[triggerx] Test email FAILED to send to {to}: {e}");
                            }
                        }
                    }
                    None => test_result.email_error = Some("SMTP not configured".into()),
                },
                Err(e) => test_result.email_error = Some(format!("Failed to read settings: {e}")),
            }
        }
    }
    test_result
}

/// Run a task immediately in a background thread. Emits events for frontend.
#[tauri::command]
fn run_now(id: String, db: tauri::State<'_, Arc<Database>>, app: tauri::AppHandle) -> Result<(), String> {
    let db_clone = db.inner().clone();
    let app_clone = app.clone();
    let _ = app.emit("task-running", serde_json::json!({"id": &id}));

    std::thread::spawn(move || {
        let task = match db_clone.get_task(&id) {
            Ok(Some(t)) => t,
            _ => { return; }
        };
        let start = std::time::Instant::now();
        let (code, stdout, stderr) = executor::execute_task(&task);
        let duration = start.elapsed().as_millis() as i64;
        eprintln!("[triggerx] --- STDOUT ---\n{}", stdout);
        if !stderr.is_empty() {
            eprintln!("[triggerx] --- STDERR ---\n{}", stderr);
        }

        let r = executor::persist_and_notify(&task, code, stdout, stderr, duration, "manual", &db_clone, &app_clone);
        match r { Ok(run_result) => { let _ = app_clone.emit("task-completed", serde_json::to_value(&run_result).unwrap_or_default()); } Err(e) => { eprintln!("[triggerx] run_now error: {e}"); } }
        
    });
    Ok(())
}

#[tauri::command]
fn check_runtimes() -> executor::RuntimeCheck {
    executor::check_runtimes()
}

#[tauri::command]
fn get_logs(db: tauri::State<'_, Arc<Database>>, task_id: String) -> Result<Vec<db::ExecutionLog>, String> {
    db.get_logs(&task_id, 50)
}

/// Compute next N occurrences of a cron expression (5 or 6 field).
#[tauri::command]
fn get_cron_times(expression: String, count: usize) -> Result<Vec<String>, String> {
    use cron::Schedule;
    use std::str::FromStr;

    let normalized = if expression.split_whitespace().count() == 5 {
        format!("0 {expression}")
    } else {
        expression.clone()
    };

    let schedule = Schedule::from_str(&normalized)
        .map_err(|e| format!("Invalid cron: {e}"))?;

    let now = chrono::Utc::now();
    let times: Vec<String> = schedule
        .after(&now)
        .take(count)
        .map(|dt| dt.to_rfc3339())
        .collect();

    Ok(times)
}

// ---- App Entry ----

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_path = dirs_db_path();
    eprintln!("[triggerx] DB path: {db_path}");

    let db = Arc::new(Database::new(&db_path).expect("Failed to initialize database"));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .manage(db.clone())
        .invoke_handler(tauri::generate_handler![
            get_tasks, add_task, update_task, delete_task, toggle_task,
            get_settings, save_settings, test_run_task, run_now, check_runtimes, get_logs, get_cron_times,
        ])
        .setup(move |app| {
            // Tray menu
            let show = tauri::menu::MenuItemBuilder::with_id("show", "显示窗口").build(app)?;
            let quit = tauri::menu::MenuItemBuilder::with_id("quit", "退出 TriggerX").build(app)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let menu = MenuBuilder::new(app).item(&show).item(&sep).item(&quit).build()?;

            let tray_icon = tauri::image::Image::from_bytes(include_bytes!("../icons/32x32.png"))
                .expect("Failed to load tray icon");

            let _tray = TrayIconBuilder::new()
                .icon(tray_icon).menu(&menu).tooltip("TriggerX — 任务调度器")
                .on_menu_event(move |app, event| match event.id().as_ref() {
                    "show" => { if let Some(w) = app.get_webview_window("main") { let _ = w.show(); let _ = w.set_focus(); } }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            // Hide to tray on close
            if let Some(window) = app.get_webview_window("main") {
                let w = window.clone();
                let _ = window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = w.hide();
                    }
                });
            }

            let handle = app.handle().clone();
            let db_clone = db.clone();
            scheduler::start_scheduler(db_clone, handle);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn dirs_db_path() -> String {
    let dir = dirs::data_dir()
        .map(|d| d.join("triggerx"))
        .unwrap_or_else(|| std::path::PathBuf::from("."));
    std::fs::create_dir_all(&dir).ok();
    dir.join("triggerx.db").to_string_lossy().to_string()
}
