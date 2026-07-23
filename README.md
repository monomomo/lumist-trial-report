# 路觅教育试听课报告系统

第一版技术栈：Next.js、Vercel、OpenAI Responses API、Supabase。

## 本地运行

```bash
npm install
cp .env.example .env.local
npm run dev
```

当前内部试用版无需账号登录，老师使用公司内部试用码生成报告，报告不会写入数据库。

## AI 配置

本地 `.env.local` 或 Vercel Production 环境变量需要配置：

```bash
OPENAI_API_KEY=你的OpenAI API Key
OPENAI_MODEL=gpt-5-mini
REPORT_ACCESS_CODE=公司内部试用码
```

`REPORT_ACCESS_CODE` 不是账号系统，只用于防止公开网址被外部人员调用并消耗 API 额度。不要把 API Key 或试用码写入代码、GitHub 或前端环境变量。

## Supabase 配置

1. 创建 Supabase 项目。
2. 在 SQL Editor 执行 `supabase/migrations/202607230001_initial_schema.sql`。
3. 在 Authentication 中创建老师账号。
4. 将项目 URL 和 Publishable Key 写入 `.env.local`。
5. 重启本地开发服务。

## Vercel 部署

1. 将本目录推送到 GitHub 仓库。
2. 在 Vercel 新建项目并导入仓库。
3. 将 Root Directory 设置为本目录。
4. 第一版配置 `OPENAI_API_KEY`、`OPENAI_MODEL`、`REPORT_ACCESS_CODE`；Supabase 暂时可以不配置。
5. 部署并使用 Vercel Preview URL 测试。
6. 测试通过后绑定正式域名。

## 当前能力

- 无需登录的内部试用入口
- SAT 试听反馈自然语言输入与 AI 结构化整理
- 个性化学习报告预览
- 动态总课时与 0.5h、1h、1.5h、2h 课程规划
- AI 生成内部销售跟进话术
- AI 异常时本地规则兜底
- 浏览器导出 PDF

## 下一阶段

- 接入老师登录与 Supabase 报告保存
- 历史报告真实列表与再次编辑
- 服务端 PDF 生成与 Supabase Storage 保存
- 管理员配置老师信息、二维码和品牌素材
