# 路觅教育试听课报告系统

第一版技术栈：Next.js、Vercel、Supabase。

## 本地运行

```bash
npm install
cp .env.example .env.local
npm run dev
```

未配置 Supabase 时，系统自动进入本地演示模式，报告不会写入数据库。

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
4. 配置 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`、`SUPABASE_SERVICE_ROLE_KEY`。
5. 部署并使用 Vercel Preview URL 测试。
6. 测试通过后绑定正式域名。

## 当前能力

- 老师账号登录
- SAT 试听反馈自然语言输入
- 个性化学习报告预览
- 动态课程规划版式
- 内部销售跟进话术
- 报告数据写入 Supabase
- 浏览器导出 PDF

## 下一阶段

- 接入大模型生成结构化报告 JSON
- 历史报告真实列表与再次编辑
- 服务端 PDF 生成与 Supabase Storage 保存
- 管理员配置老师信息、二维码和品牌素材
