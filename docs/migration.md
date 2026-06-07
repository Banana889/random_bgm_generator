# Driftone 现代化迁移说明

这次迁移的目标是保持 Driftone 现有的声音、视觉和交互尽量不变，同时把项目从零散的浏览器全局脚本整理成更容易维护、测试和打包的应用结构。

## 技术栈

- `Vite` 负责开发服务器和生产构建。
- `React` 负责 UI 状态和界面渲染。
- `TypeScript` 约束音乐数据、实时音频、环境声和 UI 状态。
- `Tone.js` 改为 npm 本地依赖，不再依赖远程 CDN。
- `SCSS` 承载当前视觉样式，方便后续整理变量、组件和动画。
- `Vitest` 覆盖核心旋律生成和数据不变量。

## 当前结构

- `src/app/App.tsx`：主应用、UI 状态、播放生命周期和调度 tick。
- `src/music/data/`：音阶、和弦、乐器、鼓点、预设包。
- `src/music/composition/nextNote.ts`：旋律权重、回家音、和弦图跳转和 motif 生成。
- `src/audio/ToneAudioBackend.ts`：当前实时 Tone.js 音频实现。
- `src/ambience/`：雨、闪电、雷声、风声相关逻辑。
- `src/platform/createTimerWorker.ts`：内联 worker 计时器，不再依赖外部旧脚本。
- `styles/main.scss`：迁移后的全局样式入口。
- `public/`：Vite 直接复制的运行时资源，包括图标、雨声和鼓采样。
- `docs/assets/`：文档截图和设计源文件，不进入生产包。

## 已清理内容

- 删除旧的 `js/` 全局脚本入口，避免新旧逻辑并存。
- 删除旧 demo HTML、旧 service worker、根目录 JSON 预设文件和零散 TODO。
- 删除 Tailwind/PostCSS 配置，改为更适合当前视觉复杂度的 SCSS。
- 删除只为未来预留、当前没有实际使用的 render/audio 抽象接口。
- 删除 TypeScript 构建缓存和误生成的 `vite.config.js/.d.ts`。
- 补充 `.gitignore`，避免提交 `node_modules`、`dist`、覆盖率、缓存和本地环境文件。

## 后续阶段

1. 行为稳定后，把更多调度逻辑从 `App.tsx` 拆到独立模块。
2. 做分段生成和预渲染原型。
3. Web 构建稳定后，再评估原生音频后端边界。
4. 分段播放稳定后，再接入 Capacitor 或 Tauri 打包。

详细目标记录在 `docs/TODO.md`。
