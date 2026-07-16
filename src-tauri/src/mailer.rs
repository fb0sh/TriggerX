use crate::db::{RunResult, SmtpConfig};
use lettre::message::header::{ContentDisposition, ContentType};
use lettre::message::SinglePart;
use lettre::transport::smtp::authentication::Credentials;
use lettre::{Message, SmtpTransport, Transport};

/// Build default HTML email: header (task info) + optional custom message + stdout/stderr.
pub fn build_email_body(task: &crate::db::Task, result: &RunResult) -> String {
    let stdout_safe = result.stdout
        .replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;");
    let stderr_safe = result.stderr
        .replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;");

    let header = format!(
        r##"<div style="border-radius:8px;border:1px solid #d0d7de;overflow:hidden">
<div style="padding:16px 24px;background:{};border-bottom:1px solid #d0d7de">
<span style="font-size:18px;font-weight:600">{}</span>
</div>
<div style="padding:16px 24px">
<table style="width:100%;font-size:14px;line-height:1.6">
<tr><td style="color:#656d76;width:80px">任务</td><td style="font-weight:600">{}</td></tr>
<tr><td style="color:#656d76">状态</td><td>{}</td></tr>
<tr><td style="color:#656d76">退出码</td><td>{}</td></tr>
<tr><td style="color:#656d76">耗时</td><td>{}ms</td></tr>
<tr><td style="color:#656d76">执行时间</td><td>{}</td></tr>
</table>
"##,
        if result.status == "success" { "#dafbe1" } else { "#ffebe9" },
        task.name,
        task.name,
        result.status,
        result.exit_code.map_or("-".into(), |c| c.to_string()),
        result.duration_ms.unwrap_or(0),
        result.executed_at,
    );

    // Custom message
    let message = if let Some(ref tmpl) = task.notify_email_template {
        if !tmpl.is_empty() {
            let rendered = render_template_vars(tmpl, task, result);
            format!("<div style=\"margin:12px 0;padding:12px;background:#f6f8fa;border-radius:6px;font-size:13px;line-height:1.5;white-space:pre-wrap\">{}</div>",
                rendered.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;"))
        } else { String::new() }
    } else { String::new() };

    let stdout_sec = if stdout_safe.is_empty() { String::new() } else {
        format!("<h4 style=\"margin:16px 0 4px;color:#656d76;font-size:12px;text-transform:uppercase\">STDOUT</h4><pre style=\"background:#f6f8fa;padding:12px;border-radius:6px;font-size:12px;white-space:pre-wrap;word-break:break-all\">{}</pre>", stdout_safe)
    };
    let stderr_sec = if stderr_safe.is_empty() { String::new() } else {
        format!("<h4 style=\"margin:16px 0 4px;color:#cf222e;font-size:12px;text-transform:uppercase\">STDERR</h4><pre style=\"background:#ffebe9;padding:12px;border-radius:6px;font-size:12px;white-space:pre-wrap;word-break:break-all;color:#cf222e\">{}</pre>", stderr_safe)
    };

    format!(
        r##"<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;padding:24px">
{}{}{}{}
</div>
</div>
"##,
        header, message, stdout_sec, stderr_sec
    )
}

/// Replace variables in a template string.
pub fn render_template_vars(tmpl: &str, task: &crate::db::Task, result: &RunResult) -> String {
    let mut out = tmpl.to_string();
    let now = chrono::Local::now();
    let time_subs: [(&str, String); 4] = [
        ("{{!date}}", now.format("%Y-%m-%d").to_string()),
        ("{{!time}}", now.format("%H:%M:%S").to_string()),
        ("{{!datetime}}", now.format("%Y-%m-%d %H:%M:%S").to_string()),
        ("{{!timestamp}}", now.timestamp().to_string()),
    ];
    for (k, v) in &time_subs { out = out.replace(k, v); }
    out = render_shell_cmds(&out);
    let task_subs: [(&str, String); 8] = [
        ("{{task.name}}", task.name.clone()),
        ("{{task.status}}", result.status.clone()),
        ("{{task.exitCode}}", result.exit_code.map_or("-".into(), |c| c.to_string())),
        ("{{task.duration}}", result.duration_ms.unwrap_or(0).to_string()),
        ("{{task.executedAt}}", result.executed_at.clone()),
        ("{{task.stdout}}", result.stdout.clone()),
        ("{{task.stderr}}", result.stderr.clone()),
        ("{{task.runCount}}", task.run_count.to_string()),
    ];
    for (k, v) in &task_subs { out = out.replace(k, v); }
    out = render_file_refs(&out);
    out
}

fn render_shell_cmds(tmpl: &str) -> String {
    let mut out = tmpl.to_string();
    loop {
        let s = out.find("{{!");
        match s {
            Some(start) => {
                let after = start + 3;
                if let Some(end) = out[after..].find("}}") {
                    let cmd: String = out[after..after + end].to_string();
                    if cmd == "date" || cmd == "time" || cmd == "datetime" || cmd == "timestamp" {
                        out.replace_range(start..after + end + 2, "");
                        continue;
                    }
                    let output = std::process::Command::new("sh")
                        .args(["-c", &cmd]).output();
                    let text = match output {
                        Ok(o) => String::from_utf8_lossy(&o.stdout).trim().to_string(),
                        Err(e) => format!("[Error: {e}]"),
                    };
                    out.replace_range(start..after + end + 2, &text);
                } else { break; }
            }
            None => break,
        }
    }
    out
}

/// Replace {{file:path}} with attachment placeholder — files are attached separately.
pub fn render_file_refs(tmpl: &str) -> String {
    let mut out = tmpl.to_string();
    let mut start = 0;
    loop {
        let open = out[start..].find("{{file:");
        match open {
            Some(pos) => {
                let abs = start + pos;
                let after = abs + 7;
                if let Some(close) = out[after..].find("}}") {
                    let path: String = out[after..after + close].to_string();
                    let fname = std::path::Path::new(&path)
                        .file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_else(|| path.clone());
                    let repl = format!("[附: {fname}]");
                    out.replace_range(abs..after + close + 2, &repl);
                    start = abs + repl.len();
                } else { break; }
            }
            None => break,
        }
    }
    out
}

/// Extract attachment file paths from raw template (before variable expansion).
pub fn collect_attachment_paths(tmpl: &str) -> Vec<String> {
    let mut paths = Vec::new();
    let mut search_from = 0;
    loop {
        if let Some(start) = tmpl[search_from..].find("{{file:") {
            let abs = search_from + start;
            let after = abs + 7;
            if let Some(end) = tmpl[after..].find("}}") {
                let path: String = tmpl[after..after + end].to_string();
                paths.push(path);
                search_from = after + end + 2;
            } else { break; }
        } else { break; }
    }
    paths
}

/// Send a notification email using the configured SMTP credentials.
pub fn send_email(smtp: &SmtpConfig, to: &str, task: &crate::db::Task, result: &RunResult) -> Result<(), String> {
    let subject = format!("[TriggerX] {} - {}", task.name, result.status);

    let (body, attachments) = if let Some(ref tmpl) = task.notify_email_template {
        if !tmpl.is_empty() {
            let att_paths = collect_attachment_paths(tmpl);
            let rendered = render_template_vars(tmpl, task, result);
            let html = format!("<pre style='font-family:monospace;font-size:13px;line-height:1.5;white-space:pre-wrap;word-break:break-all'>{}</pre>",
                rendered.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;"));
            (html, att_paths)
        } else {
            (build_email_body(task, result), vec![])
        }
    } else {
        (build_email_body(task, result), vec![])
    };

    send_raw_email(smtp, to, &subject, &body, &attachments)
}

fn send_raw_email(smtp: &SmtpConfig, to: &str, subject: &str, body: &str, attachments: &[String]) -> Result<(), String> {
    let addrs: Vec<&str> = to.split(';').map(|s| s.trim()).filter(|s| !s.is_empty()).collect();
    if addrs.is_empty() {
        return Err("No valid email recipients".into());
    }
    let mut builder = Message::builder()
        .from(smtp.from.parse().map_err(|e| format!("Invalid from: {e}"))?);
    for addr in &addrs {
        builder = builder.to(addr.parse().map_err(|e| format!("Invalid address '{addr}': {e}"))?);
    }
    let email = if attachments.is_empty() {
        builder
            .subject(subject)
            .header(ContentType::TEXT_HTML)
            .body(body.to_string())
            .map_err(|e| format!("Email build error: {e}"))?
    } else {
        use lettre::message::MultiPart;
        let mut multipart = MultiPart::mixed()
            .singlepart(
                SinglePart::builder()
                    .header(ContentType::TEXT_HTML)
                    .body(body.to_string()),
            );
        for path in attachments {
            let fname = std::path::Path::new(path)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "attachment".into());
            match std::fs::read(path) {
                Ok(data) => {
                    let part = SinglePart::builder()
                        .header(ContentType::parse("application/octet-stream").unwrap())
                        .header(ContentDisposition::attachment(&fname))
                        .body(data);
                    multipart = multipart.multipart(
                        lettre::message::MultiPart::mixed().singlepart(part),
                    );
                    eprintln!("[triggerx] Attached file: {path}");
                }
                Err(e) => eprintln!("[triggerx] Failed to read attachment {path}: {e}"),
            }
        }
        builder
            .subject(subject)
            .multipart(multipart)
            .map_err(|e| format!("Email build error: {e}"))?
    };

    eprintln!("[triggerx] Building SMTP transport to {}:{}", smtp.host, smtp.port);
    let creds = Credentials::new(smtp.username.clone(), smtp.password.clone());
    let transport = SmtpTransport::relay(&smtp.host)
        .map_err(|e| {
            eprintln!("[triggerx] SMTP relay error: {e}");
            format!("SMTP relay error: {e}")
        })?
        .port(smtp.port)
        .credentials(creds)
        .build();

    eprintln!("[triggerx] Sending email to {to}...");
    match transport.send(&email) {
        Ok(_) => {
            eprintln!("[triggerx] Email sent successfully to {to}");
            Ok(())
        }
        Err(e) => {
            let msg = format!("Send email error: {e}");
            eprintln!("[triggerx] {msg}");
            Err(msg)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Task;
    use serde_json::json;

    fn make_task() -> Task {
        Task {
            id: "test-id".into(),
            name: "test-task".into(),
            enabled: true,
            config: json!({"type": "shell", "shell": {"command": "echo hi"}}),
            schedule: json!({"kind": "cron"}),
            last_run: None,
            created_at: "2026-01-01T00:00:00Z".into(),
            updated_at: "2026-01-01T00:00:00Z".into(),
            run_count: 0,
            notify_system: None,
            notify_system_on_failure_only: None,
            notify_email: None,
            notify_email_to: None,
            notify_email_on_failure_only: None,
            notify_email_template: None,
        }
    }

    fn make_result() -> RunResult {
        RunResult {
            status: "success".into(),
            exit_code: Some(0),
            stdout: "hello world".into(),
            stderr: String::new(),
            executed_at: "2026-01-01T00:01:00Z".into(),
            duration_ms: Some(100),
            error: None,
        }
    }

    #[test]
    fn test_render_template_vars_basic() {
        let task = make_task();
        let result = make_result();
        let tmpl = "{{task.name}} - {{task.status}} ({{task.exitCode}})";
        assert_eq!(render_template_vars(tmpl, &task, &result), "test-task - success (0)");
    }

    #[test]
    fn test_render_template_vars_all_vars() {
        let task = make_task();
        let mut result = make_result();
        result.stdout = "out".into();
        result.stderr = "err".into();
        result.duration_ms = Some(1234);

        let tmpl = "{name}{{{task.name}}}{status}{{{task.status}}}{exit}{{{task.exitCode}}}{dur}{{{task.duration}}}{time}{{{task.executedAt}}}{stdout}{{{task.stdout}}}{stderr}{{{task.stderr}}}";
        let out = render_template_vars(tmpl, &task, &result);
        assert!(out.contains("test-task"));
        assert!(out.contains("success"));
        assert!(out.contains("1234"));
        assert!(out.contains("out"));
        assert!(out.contains("err"));
    }

    #[test]
    fn test_render_template_vars_empty() {
        let task = make_task();
        let result = make_result();
        assert_eq!(render_template_vars("", &task, &result), "");
    }

    #[test]
    fn test_render_template_vars_no_placeholders() {
        let task = make_task();
        let result = make_result();
        assert_eq!(render_template_vars("plain text", &task, &result), "plain text");
    }

    #[test]
    fn test_render_file_refs_no_refs() {
        assert_eq!(render_file_refs("hello world"), "hello world");
    }

    #[test]
    fn test_render_file_refs_placeholder() {
        let out = render_file_refs("before {{file:/some/path/file.txt}} after");
        assert!(out.contains("[附: file.txt]"));
        assert!(!out.contains("Error"));
    }

    #[test]
    fn test_collect_attachment_paths() {
        let paths = collect_attachment_paths("a {{file:/a/b.txt}} c {{file:/d.log}} e");
        assert_eq!(paths.len(), 2);
        assert!(paths[0].ends_with("b.txt"));
        assert!(paths[1].ends_with("d.log"));
    }
}
