# Cloud Bills 控制台（Dashboard）

基于 Vue 3 + Tailwind CSS v4 的单页应用，用于展示来自后端 API 的云支出数据。

## 技术栈

- [Vue 3](https://vuejs.org)（Composition API，`<script setup>`）
- [Vite 6](https://vitejs.dev)（开发服务器，代理到后端）
- [Tailwind CSS v4](https://tailwindcss.com)
- TypeScript

## 前置条件

后端服务器必须运行在 `http://localhost:3000`。请参阅 [主 README](../README_CN.md) 进行配置。

## 开发

```bash
# 安装依赖
bun install

# 启动开发服务器（将 /balance 代理到 http://localhost:3000）
bun run dev
```

在浏览器中打开 **http://localhost:5173**。

## 测试

```bash
bun test
```

## 构建

```bash
bun run build   # 输出到 dist/
bun run preview # 本地预览生产构建
```

## 功能特性

- **汇总卡片** — 按服务商显示总费用，固定在页面顶部
- **账户列表** — 所有账户按费用从高到低排序，错误账户显示在底部
- **亮色/暗色主题** — 在页头切换；默认跟随系统偏好，页面刷新后保持
- **响应式布局** — 桌面端 4 列汇总，移动端 2 列
- **手动刷新** — 页头刷新按钮重新请求 `/balance`
