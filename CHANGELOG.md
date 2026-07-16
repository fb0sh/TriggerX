# 更新日志

格式基于 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)，
版本号遵循 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)。

## [0.1.0] - 2026-07-16

### Added

- 三种任务类型：Shell 命令、命令行工具、代码片段
- Cron 表达式调度 + 一次性延迟执行
- SMTP 邮件通知，支持 `{{task.*}}` 模板变量 + 文件附件
- 系统原生通知
- 排序（按时间/名称）与筛选（全部/已启用/已禁用）
- 立即执行按钮，不影响计划调度
- 执行历史持久化（execution_logs 表）
- 邮件模板系统：时间变量 `{{!date}}`、Shell 展开 `{{!uname -a}}`、文件引用 `{{file:path}}`
- 执行次数计数器
- 托盘常驻 + 窗口隐藏到托盘
- GitHub 风格 UI（Primer Design System + Octicons）
- 跨平台：macOS ARM + Intel、Windows、Linux
