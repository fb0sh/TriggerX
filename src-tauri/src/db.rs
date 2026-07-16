use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub config: serde_json::Value,
    pub schedule: serde_json::Value,
    pub last_run: Option<serde_json::Value>,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub run_count: i64,
    #[serde(default)]
    pub notify: serde_json::Value, // JSON: { system: bool, systemOnFailureOnly: bool, email: bool, emailTo: string, ... }
}

impl Task {
    pub fn notify_system(&self) -> Option<bool> {
        self.notify.get("system").and_then(|v| v.as_bool())
    }
    pub fn notify_system_on_failure_only(&self) -> Option<bool> {
        self.notify.get("systemOnFailureOnly").and_then(|v| v.as_bool())
    }
    pub fn notify_email(&self) -> Option<bool> {
        self.notify.get("email").and_then(|v| v.as_bool())
    }
    pub fn notify_email_to(&self) -> Option<&str> {
        self.notify.get("emailTo").and_then(|v| v.as_str())
    }
    pub fn notify_email_on_failure_only(&self) -> Option<bool> {
        self.notify.get("emailOnFailureOnly").and_then(|v| v.as_bool())
    }
    pub fn notify_email_template(&self) -> Option<&str> {
        self.notify.get("emailTemplate").and_then(|v| v.as_str())
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub smtp: Option<SmtpConfig>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SmtpConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub from: String,
    #[serde(default)]
    pub use_tls: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RunResult {
    pub status: String,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub executed_at: String,
    pub duration_ms: Option<i64>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionLog {
    pub id: i64,
    pub task_id: String,
    pub status: String,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub executed_at: String,
    pub duration_ms: Option<i64>,
    pub error: Option<String>,
    pub trigger: String,
    pub run_count: i64,
}

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new(path: &str) -> Result<Self, String> {
        let conn = Connection::open(path).map_err(|e| format!("Failed to open DB: {e}"))?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                config TEXT NOT NULL DEFAULT '{}',
                schedule TEXT NOT NULL DEFAULT '{}',
                last_run TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                run_count INTEGER NOT NULL DEFAULT 0,
                notify TEXT NOT NULL DEFAULT '{}'
            );
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS execution_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id TEXT NOT NULL,
                status TEXT NOT NULL,
                exit_code INTEGER,
                stdout TEXT NOT NULL DEFAULT '',
                stderr TEXT NOT NULL DEFAULT '',
                executed_at TEXT NOT NULL,
                duration_ms INTEGER,
                error TEXT,
                trigger TEXT NOT NULL DEFAULT 'scheduled',
                run_count INTEGER NOT NULL DEFAULT 0
            );"
        ).map_err(|e| format!("Failed to create tables: {e}"))?;

        // Migration: add notify column if missing
        let cols: Vec<String> = conn
            .prepare("PRAGMA table_info(tasks)").map_err(|e| e.to_string())?
            .query_map([], |row| row.get::<_, String>(1)).map_err(|e| e.to_string())?
            .filter_map(|r| r.ok()).collect();

        // Migration: add notify column if missing
        if !cols.iter().any(|c| c == "notify") {
            conn.execute("ALTER TABLE tasks ADD COLUMN notify TEXT NOT NULL DEFAULT '{}'", [])
                .map_err(|e| format!("Migration failed: {e}"))?;
        }
        // Migration: add run_count to execution_logs
        let log_cols: Vec<String> = conn
            .prepare("PRAGMA table_info(execution_logs)").map_err(|e| e.to_string())?
            .query_map([], |row| row.get::<_, String>(1)).map_err(|e| e.to_string())?
            .filter_map(|r| r.ok()).collect();
        if !log_cols.iter().any(|c| c == "run_count") {
            conn.execute("ALTER TABLE execution_logs ADD COLUMN run_count INTEGER NOT NULL DEFAULT 0", [])
                .map_err(|e| format!("Migration failed: {e}"))?;
            // Migrate old column data to notify JSON
            if cols.iter().any(|c| c == "notify_system") {
                conn.execute_batch(
                    "UPDATE tasks SET notify = json_object(
                        'system', CASE WHEN notify_system IS NULL THEN json('true') ELSE json(notify_system != 0) END,
                        'systemOnFailureOnly', CASE WHEN notify_system_on_failure_only IS NULL THEN json('false') ELSE json(notify_system_on_failure_only != 0) END,
                        'email', CASE WHEN notify_email IS NULL THEN json('false') ELSE json(notify_email != 0) END,
                        'emailTo', CASE WHEN notify_email_to IS NULL THEN '' ELSE notify_email_to END,
                        'emailOnFailureOnly', CASE WHEN notify_email_on_failure_only IS NULL THEN json('false') ELSE json(notify_email_on_failure_only != 0) END,
                        'emailTemplate', CASE WHEN notify_email_template IS NULL THEN '' ELSE notify_email_template END
                    )"
                ).ok();
            }
        }

        Ok(Database { conn: Mutex::new(conn) })
    }

    fn row_to_task(row: &rusqlite::Row) -> rusqlite::Result<Task> {
        let last_run_str: Option<String> = row.get(5)?;
        let last_run = last_run_str.and_then(|s| serde_json::from_str(&s).ok());
        Ok(Task {
            id: row.get(0)?,
            name: row.get(1)?,
            enabled: row.get::<_, i32>(2)? != 0,
            config: serde_json::from_str(&row.get::<_, String>(3)?).unwrap_or_default(),
            schedule: serde_json::from_str(&row.get::<_, String>(4)?).unwrap_or_default(),
            last_run,
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
            run_count: row.get::<_, i64>(8)?,
            notify: serde_json::from_str(&row.get::<_, String>(9)?).unwrap_or_default(),
        })
    }

    const TASK_SELECT: &str = "SELECT id, name, enabled, config, schedule, last_run, created_at, updated_at, run_count, notify FROM tasks";

    pub fn get_all_tasks(&self) -> Result<Vec<Task>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare(&format!("{} ORDER BY created_at DESC", Self::TASK_SELECT)).map_err(|e| e.to_string())?;
        let tasks = stmt.query_map([], |row| Self::row_to_task(row)).map_err(|e| e.to_string())?;
        let mut result = Vec::new();
        for task in tasks { result.push(task.map_err(|e| e.to_string())?); }
        Ok(result)
    }

    pub fn get_task(&self, id: &str) -> Result<Option<Task>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare(&format!("{} WHERE id = ?1", Self::TASK_SELECT)).map_err(|e| e.to_string())?;
        let mut rows = stmt.query_map(params![id], |row| Self::row_to_task(row)).map_err(|e| e.to_string())?;
        Ok(rows.next().and_then(|r| r.ok()))
    }

    pub fn add_task(&self, task: &Task) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO tasks (id, name, enabled, config, schedule, last_run, created_at, updated_at, run_count, notify) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                task.id, task.name, task.enabled as i32,
                serde_json::to_string(&task.config).unwrap_or_default(),
                serde_json::to_string(&task.schedule).unwrap_or_default(),
                task.last_run.as_ref().and_then(|v| serde_json::to_string(v).ok()),
                task.created_at, task.updated_at, task.run_count,
                serde_json::to_string(&task.notify).unwrap_or_default(),
            ],
        ).map_err(|e| format!("Insert error: {e}"))?;
        Ok(())
    }

    pub fn update_task(&self, task: &Task) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let affected = conn.execute(
            "UPDATE tasks SET name=?1, enabled=?2, config=?3, schedule=?4, last_run=?5, updated_at=?6, run_count=?7, notify=?8 WHERE id=?9",
            params![
                task.name, task.enabled as i32,
                serde_json::to_string(&task.config).unwrap_or_default(),
                serde_json::to_string(&task.schedule).unwrap_or_default(),
                task.last_run.as_ref().and_then(|v| serde_json::to_string(v).ok()),
                task.updated_at, task.run_count,
                serde_json::to_string(&task.notify).unwrap_or_default(),
                task.id,
            ],
        ).map_err(|e| format!("Update error: {e}"))?;
        if affected == 0 { return Err(format!("Task {} not found", task.id)); }
        Ok(())
    }

    pub fn update_task_enabled(&self, id: &str, enabled: bool) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute("UPDATE tasks SET enabled=?1, updated_at=?2 WHERE id=?3", params![enabled as i32, now, id])
            .map_err(|e| format!("Update error: {e}"))?;
        Ok(())
    }

    pub fn delete_task(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM tasks WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
        Ok(())
    }

    // ---- Settings ----

    pub fn get_settings(&self) -> Result<AppSettings, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = 'app_settings'").map_err(|e| e.to_string())?;
        let value: Option<String> = stmt.query_map([], |row| row.get(0)).map_err(|e| e.to_string())?
            .next().and_then(|r| r.ok());
        match value {
            Some(json) => serde_json::from_str(&json).map_err(|e| format!("Deser error: {e}")),
            None => Ok(AppSettings { smtp: None }),
        }
    }

    pub fn save_settings(&self, settings: &AppSettings) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let json = serde_json::to_string(settings).map_err(|e| format!("Ser error: {e}"))?;
        conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('app_settings', ?1)", params![json])
            .map_err(|e| format!("Save error: {e}"))?;
        Ok(())
    }

    // ---- Execution Logs ----

    pub fn insert_log(&self, task_id: &str, status: &str, exit_code: Option<i32>, stdout: &str, stderr: &str, executed_at: &str, duration_ms: Option<i64>, error: Option<&str>, trigger: &str, run_count: i64) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO execution_logs (task_id, status, exit_code, stdout, stderr, executed_at, duration_ms, error, trigger, run_count) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
            params![task_id, status, exit_code, stdout, stderr, executed_at, duration_ms, error, trigger, run_count],
        ).map_err(|e| format!("Insert log error: {e}"))?;
        Ok(())
    }

    pub fn get_logs(&self, task_id: &str, limit: i64) -> Result<Vec<ExecutionLog>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare(
            "SELECT id, task_id, status, exit_code, stdout, stderr, executed_at, duration_ms, error, trigger, COALESCE(run_count, 0) FROM execution_logs WHERE task_id = ?1 ORDER BY executed_at DESC LIMIT ?2"
        ).map_err(|e| e.to_string())?;
        let logs = stmt.query_map(params![task_id, limit], |row| {
            Ok(ExecutionLog {
                id: row.get(0)?, task_id: row.get(1)?, status: row.get(2)?,
                exit_code: row.get(3)?, stdout: row.get(4)?, stderr: row.get(5)?,
                executed_at: row.get(6)?, duration_ms: row.get(7)?, error: row.get(8)?, trigger: row.get(9)?,
                run_count: row.get(10)?,
            })
        }).map_err(|e| e.to_string())?;
        let mut result = Vec::new();
        for log in logs { result.push(log.map_err(|e| e.to_string())?); }
        Ok(result)
    }

    // ---- Executor ----

    pub fn get_enabled_tasks(&self) -> Result<Vec<Task>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare(&format!("{} WHERE enabled = 1", Self::TASK_SELECT)).map_err(|e| e.to_string())?;
        let tasks = stmt.query_map([], |row| Self::row_to_task(row)).map_err(|e| e.to_string())?;
        let mut result = Vec::new();
        for task in tasks { result.push(task.map_err(|e| e.to_string())?); }
        Ok(result)
    }
}
