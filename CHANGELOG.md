# 更新日志

格式基于 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)，
版本号遵循 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)。

## [0.3.0] - 2026-07-17

### Changed

- **架构重构**：五轮迭代，87 个测试覆盖（27 → 87）
- App.tsx 从 610 行深化为 ~85 行薄壳
- TaskDialog 从 638 行拆分为 ScheduleSection / NotificationSection / TaskDialog 三个模块
- TaskListView 提取 useRunNow 和 useCronTimeCache 自定义 Hook
- executor.rs 三分：executor（执行）/ orchestrator（编排）/ runtime（运行时检测）
- IPC 调用统一到 ipc.ts，类型化封装 12 条 Tauri 命令
- Store 添加乐观更新失败回滚
- toggle_task 修复协议不匹配（后端现在使用 enabled 参数）
- 共享工具函数：formatDt / formatStatus / relativeTime / formatDuration / OutputBlock
- Cron 逻辑统一到 cron-utils.tsx（describeCron / estimateNextRun / CronPreview）

### Added

- db.rs 集成测试（15 个）：CRUD、设置、日志、迁移
- engine.rs 调度测试（14 个）：normalize_cron、cron/once 调度匹配
- template.rs 测试（13 个）：status_cn、build_email_body、HTML 转义
- cron-utils.tsx 测试（20 个）：describeCron 各模式、estimateNextRun、getNextCronTimes JS 回退
- store 测试（8 个）：乐观更新 + 回滚验证
- FlashMessage 组件（自动消失 + 复用）
- hooks/useRunNow.ts（轮询 + 事件监听 + 多任务竞态修复）
- hooks/useCronTimeCache.ts（15s 刷新 Cron 时间缓存）

### Removed

- 死代码：ScheduleForm.tsx、RunStatus 的 running/pending、LanguageConfig.runtimeAvailable、store.error、生产 mock 数据、utils.test.ts 中的 filterTasks
- 重复代码：formatDisplay（cron-utils）→ formatDt（utils）、notifier.rs 内联 status_cn → template::status_cn()
- SettingsDialog 重复的 loadSettings() 调用

## [0.2.1] - 2026-07-17

### Fixed

- UI version display 0.1.0 → 0.2.0

## [0.2.0] - 2026-07-17

### Added

- 动态版本号通过 get_version 命令从 Cargo.toml 读取

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
