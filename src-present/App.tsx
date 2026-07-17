import { useState, useEffect } from "react";
import { ThemeProvider, BaseStyles } from "@primer/react";
import App from "../src/App";

/* ─── Styles ─────────────────────────────────────────────────────────── */

const styles = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
  a { color: #0969da; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .app-window { border: 1px solid #d0d7de; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); background: #fff; width: 100%; max-width: 900px; height: 520px; flex-shrink: 0; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  .anim-fade { animation: fadeUp 0.5s ease both; }
  .anim-fade-1 { animation: fadeUp 0.5s 0.1s ease both; }
  .anim-fade-2 { animation: fadeUp 0.5s 0.2s ease both; }
  .anim-fade-3 { animation: fadeUp 0.5s 0.3s ease both; }
`;

const VERSION = "v0.2.1";

/* ─── Features ───────────────────────────────────────────────────────── */

const features = [
  { icon: "⚡", title: "三种任务类型", desc: "Shell 命令 / 命令行工具 (flag 式) / 代码片段 (JS/Python/Rust/Shell)" },
  { icon: "⏱", title: "可视化 Cron 编辑器", desc: "react-js-cron 图形化选择周期/日/时/分，支持手写输入，实时显示近5次执行时间" },
  { icon: "📧", title: "邮件通知", desc: "SMTP 支持 + 自动 TLS 协商 (STARTTLS/隐式TLS 自动降级) + 自定义模板 + {{task.*}} 变量 + {{file:path}} 附件" },
  { icon: "🔔", title: "系统通知", desc: "macOS / Windows / Linux 原生系统通知" },
  { icon: "▶", title: "立即执行", desc: "任意任务随时手动运行，不影响原有 cron/once 调度计划" },
  { icon: "📋", title: "执行历史", desc: "每次执行持久化到 SQLite，区分定时/手动触发，带 #N 编号，可查看 stdout/stderr" },
  { icon: "🎨", title: "GitHub 风格", desc: "Primer Design System + Octicons + antd Cron 组件，深色/浅色模式" },
  { icon: "🖥", title: "跨平台", desc: "macOS (ARM) / Windows (x64) / Linux (x64)，纯 Rust TLS 无系统依赖" },
  { icon: "🧩", title: "模板变量系统", desc: "{{!date}} 时间变量、{{!command}} Shell 展开、{{file:path}} 附件引用、{{task.statusText}} 中文状态" },
  { icon: "🔢", title: "执行计数器", desc: "自动追踪每个任务的执行次数，邮件主题和列表显示 #N" },
  { icon: "🗑", title: "删除确认", desc: "GitHub 风格 Dialog 确认删除，防止误操作" },
  { icon: "📄", title: "内联输出", desc: "任务列表直接展开查看上次执行 stdout/stderr，无需打开历史对话框" },
];

/* ─── Page ───────────────────────────────────────────────────────────── */

function Page() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);

  return (
    <>
      <style>{styles}</style>

      {/* Nav */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", height: 56,
        background: scrolled ? "#fffffff2" : "#fff",
        backdropFilter: scrolled ? "blur(8px)" : "none",
        borderBottom: "1px solid #d0d7de", transition: "all 0.2s",
      }}>
        <span style={{ fontWeight: 700, fontSize: 16, color: "#1f2328" }}>
          ⚡ TriggerX
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="https://github.com/fb0sh/TriggerX/releases/latest" target="_blank">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 6, fontSize: 14, fontWeight: 600, background: "#0969da", color: "#fff" }}>
              📥 下载
            </span>
          </a>
          <a href="https://github.com/fb0sh/TriggerX" target="_blank">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 6, fontSize: 14, fontWeight: 600, background: "#f6f8fa", color: "#1f2328", border: "1px solid #d0d7de" }}>
              GitHub →
            </span>
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "80px 24px 40px", textAlign: "center",
        background: "linear-gradient(180deg, #f0f6ff 0%, #ffffff 60%)",
      }}>
        <div className="anim-fade" style={{ maxWidth: 860, width: "100%" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: "#ddf4e4", color: "#1a7f37", border: "1px solid #acebbe", marginBottom: 20 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1f883d", display: "inline-block" }} />
            {VERSION} — 轻量任务调度器
          </div>
          <h1 style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 16, color: "#1f2328", lineHeight: 1.2 }}>
            定时执行 · 邮件通知
          </h1>
          <p style={{ fontSize: 18, color: "#656d76", maxWidth: 560, margin: "0 auto 32px", lineHeight: 1.6 }}>
            TriggerX 是一款轻量级桌面任务调度器。支持 Shell 命令、命令行工具、代码片段三种任务类型，
            Cron/一次性调度，SMTP 邮件通知 + 自定义模板，跨平台运行。
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="https://github.com/fb0sh/TriggerX/releases/latest" target="_blank">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 28px", borderRadius: 8, fontSize: 16, fontWeight: 600, background: "#0969da", color: "#fff" }}>
                📥 下载 TriggerX
              </span>
            </a>
            <a href="https://github.com/fb0sh/TriggerX" target="_blank">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 28px", borderRadius: 8, fontSize: 16, fontWeight: 600, background: "#f6f8fa", color: "#1f2328", border: "1px solid #d0d7de" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                Source
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* Live Demo */}
      <section style={{ padding: "60px 24px", background: "#f6f8fa" }}>
        <div className="anim-fade" style={{ maxWidth: 900, margin: "0 auto" }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, color: "#1f2328", textAlign: "center" }}>
            实际体验
          </h2>
          <p style={{ textAlign: "center", color: "#656d76", marginBottom: 32, fontSize: 15 }}>
            完整的 TriggerX 界面，直接在浏览器中操作
          </p>
          <div className="anim-fade-1" style={{ border: "1px solid #d0d7de", borderRadius: 10, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", background: "#fff" }}>
            <ThemeProvider>
              <BaseStyles>
                <div style={{ height: 520, overflow: "hidden" }}>
                  <App />
                </div>
              </BaseStyles>
            </ThemeProvider>
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: "60px 24px", maxWidth: 940, margin: "0 auto" }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 40, color: "#1f2328", textAlign: "center" }}>
          核心特性
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {features.map((f, i) => (
            <div key={f.title} className={`anim-fade-${i % 4}`} style={{ padding: 24, borderRadius: 8, border: "1px solid #d0d7de", background: "#fff", transition: "all 0.2s" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{f.icon}</div>
              <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 15, color: "#1f2328" }}>{f.title}</div>
              <div style={{ color: "#656d76", lineHeight: 1.6, fontSize: 13 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Tech */}
      <section style={{ padding: "60px 24px", background: "#f6f8fa" }}>
        <div className="anim-fade" style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 32, color: "#1f2328" }}>技术栈</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            {[["Tauri 2", "桌面框架"], ["React 19", "前端"], ["Primer React", "UI 组件"], ["Zustand 5", "状态管理"], ["Rust", "后端引擎"], ["SQLite (rusqlite)", "数据库"], ["Lettre", "SMTP 邮件"], ["cron crate", "调度解析"]].map(([name, desc]) => (
              <span key={name} style={{ display: "inline-flex", gap: 4, padding: "6px 12px", borderRadius: 6, background: "#fff", border: "1px solid #d0d7de", fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{name}</span>
                <span style={{ color: "#656d76" }}>— {desc}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "60px 24px 80px", textAlign: "center" }}>
        <div className="anim-fade">
          <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 16, color: "#1f2328" }}>立即开始使用</h2>
          <p style={{ color: "#656d76", marginBottom: 28, fontSize: 15 }}>免费、开源、跨平台。定时任务调度 + 邮件通知，一切尽在 TriggerX。</p>
          <a href="https://github.com/fb0sh/TriggerX/releases/latest" target="_blank">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 28px", borderRadius: 8, fontSize: 16, fontWeight: 600, background: "#0969da", color: "#fff" }}>
              📥 下载 TriggerX
            </span>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ textAlign: "center", padding: "24px", borderTop: "1px solid #d0d7de", color: "#656d76", fontSize: 13 }}>
        <p>TriggerX — GPL-3.0 License</p>
        <p style={{ marginTop: 4 }}>
          <a href="https://github.com/fb0sh/TriggerX" target="_blank">GitHub</a>
          {" · "}
          <a href="https://github.com/fb0sh/TriggerX/releases" target="_blank">Releases</a>
          {" · "}Made with ❤️
        </p>
      </footer>
    </>
  );
}

export default function AppOuter() {
  return (
    <ThemeProvider>
      <BaseStyles>
        <Page />
      </BaseStyles>
    </ThemeProvider>
  );
}
