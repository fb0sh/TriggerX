use crate::db::{RunResult, SmtpConfig};
use lettre::message::header::{ContentDisposition, ContentType};
use lettre::message::SinglePart;
use lettre::transport::smtp::authentication::Credentials;
use lettre::{Message, SmtpTransport, Transport};

/// Send email using the configured template or default format.
pub fn send_email(smtp: &SmtpConfig, to: &str, task: &crate::db::Task, result: &RunResult) -> Result<(), String> {
    let subject = format!("[TriggerX] {} - {}", task.name, result.status);
    let (body, attachments) = if let Some(tmpl) = task.notify_email_template() {
        if !tmpl.is_empty() {
            let att_paths = crate::template::collect_attachment_paths(tmpl);
            let rendered = crate::template::render_template_vars(tmpl, task, result);
            let html = format!("<pre style='font-family:monospace;font-size:13px;line-height:1.5;white-space:pre-wrap;word-break:break-all'>{}</pre>",
                rendered.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;"));
            (html, att_paths)
        } else { (crate::template::build_email_body(task, result), vec![]) }
    } else { (crate::template::build_email_body(task, result), vec![]) };
    send_raw(smtp, to, &subject, &body, &attachments)
}

fn send_raw(smtp: &SmtpConfig, to: &str, subject: &str, body: &str, attachments: &[String]) -> Result<(), String> {
    let addrs: Vec<&str> = to.split(';').map(|s| s.trim()).filter(|s| !s.is_empty()).collect();
    if addrs.is_empty() { return Err("No valid email recipients".into()); }
    let mut builder = Message::builder()
        .from(smtp.from.parse().map_err(|e| format!("Invalid from: {e}"))?);
    for addr in &addrs {
        builder = builder.to(addr.parse().map_err(|e| format!("Invalid address '{addr}': {e}"))?);
    }
    let email = if attachments.is_empty() {
        builder.subject(subject).header(ContentType::TEXT_HTML)
            .body(body.to_string()).map_err(|e| format!("Email build error: {e}"))?
    } else {
        let mut multipart = lettre::message::MultiPart::mixed()
            .singlepart(lettre::message::SinglePart::builder()
                .header(ContentType::TEXT_HTML).body(body.to_string()));
        for path in attachments {
            let fname = std::path::Path::new(path)
                .file_name().map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "attachment".into());
            if let Ok(data) = std::fs::read(path) {
                let part = lettre::message::SinglePart::builder()
                    .header(ContentType::parse("application/octet-stream").unwrap())
                    .header(ContentDisposition::attachment(&fname))
                    .body(data);
                multipart = multipart.multipart(lettre::message::MultiPart::mixed().singlepart(part));
                eprintln!("[triggerx] Attached file: {path}");
            } else { eprintln!("[triggerx] Failed to read attachment {path}"); }
        }
        builder.subject(subject).multipart(multipart)
            .map_err(|e| format!("Email build error: {e}"))?
    };

    eprintln!("[triggerx] Building SMTP transport (plain) to {}:{}", smtp.host, smtp.port);
    let creds = Credentials::new(smtp.username.clone(), smtp.password.clone());
    let transport = SmtpTransport::builder_dangerous(&smtp.host)
        .port(smtp.port).credentials(creds).build();

    eprintln!("[triggerx] Sending email to {to}...");
    match transport.send(&email) {
        Ok(_) => { eprintln!("[triggerx] Email sent successfully to {to}"); Ok(()) }
        Err(e) => { let msg = format!("Send email error: {e}"); eprintln!("[triggerx] {msg}"); Err(msg) }
    }
}
