import { useState } from 'react';

const VERSION = 'v0.1.0';

export default function App() {
  return (
    <div style={{
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      maxWidth: 720, margin: '0 auto', padding: '32px 16px', color: '#1f2328',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <img
          src="../src-tauri/icons/icon.png"
          alt="TriggerX"
          style={{ width: 96, height: 96, borderRadius: 20 }}
        />
        <h1 style={{ margin: '16px 0 4px', fontSize: 32, fontWeight: 700 }}>
          TriggerX
        </h1>
        <p style={{ margin: 0, fontSize: 16, color: '#656d76' }}>
          轻量任务调度器 · {VERSION}
        </p>
        <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="https://github.com/fb0sh/TriggerX/releases/latest"
             style={{ padding: '8px 20px', borderRadius: 6, background: '#0969da', color: '#fff',
                      textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
            📥 下载最新版
          </a>
          <a href="https://github.com/fb0sh/TriggerX"
             style={{ padding: '8px 20px', borderRadius: 6, border: '1px solid #d0d7de',
                      textDecoration: 'none', fontWeight: 600, fontSize: 14, color: '#1f2328' }}>
            GitHub →
          </a>
        </div>
      </div>

      {/* Features */}
      <Features />

      {/* Tech */}
      <TechStack />

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: 64, padding: '24px 0',
                     borderTop: '1px solid #d0d7de', fontSize: 12, color: '#656d76' }}>
        <p>TriggerX {VERSION} · GPL-3.0 License</p>
      </div>
    </div>
  );
}

function Features() {
  const features = [
    { icon: '⚡', title: '任务类型', desc: 'Shell 命令 / 命令行工具 / 代码片段 (JS/Python/Rust/Shell)' },
    { icon: '⏱', title: '灵活调度', desc: 'Cron 表达式 + 预设 + 一次性延迟执行' },
    { icon: '📧', title: '邮件通知', desc: 'SMTP 支持 + 自定义模板 + {{task.*}} 变量 + 文件附件' },
    { icon: '🔔', title: '系统通知', desc: 'macOS / Windows / Linux 原生通知' },
    { icon: '📋', title: '执行历史', desc: '每次执行持久化，区分定时/手动触发' },
    { icon: '▶', title: '立即执行', desc: '随时运行任意任务，不影响原有调度计划' },
    { icon: '🎨', title: 'GitHub 风格', desc: 'Primer Design System + Octicons 界面' },
    { icon: '🖥', title: '跨平台', desc: 'macOS (ARM) / Windows / Linux' },
  ];

  return (
    <div style={{ marginBottom: 48 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>功能特性</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        {features.map(f => (
          <div key={f.title} style={{
            padding: 16, borderRadius: 8, border: '1px solid #d0d7de',
            background: '#f6f8fa',
          }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{f.icon}</div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{f.title}</div>
            <div style={{ fontSize: 13, color: '#656d76', lineHeight: 1.5 }}>{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TechStack() {
  const items = [
    ['Tauri 2', '桌面框架'],
    ['React 19', '前端'],
    ['Primer React 38', 'UI 组件'],
    ['Zustand 5', '状态管理'],
    ['Rust', '后端'],
    ['SQLite', '数据库'],
    ['Lettre', '邮件'],
    ['cron crate', '调度'],
  ];

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>技术栈</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {items.map(([name, role]) => (
          <span key={name} style={{
            padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600,
            border: '1px solid #d0d7de', color: '#0969da',
          }}>
            {name}
            <span style={{ color: '#656d76', fontWeight: 400 }}> · {role}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
