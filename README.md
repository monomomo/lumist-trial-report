# 路觅教育试听课报告系统

第二版技术栈：Next.js、Vercel、OpenAI Responses API、Supabase Auth + Database。

详细部署与技术说明见 [`docs/TECHNICAL_HANDOFF.md`](./docs/TECHNICAL_HANDOFF.md)。

## 本地运行

```bash
npm install
cp .env.example .env.local
npm run dev
```

老师使用账号名和密码登录，无需注册。系统会在后台将账号名映射为 Supabase Authentication 使用的内部认证地址，老师端不展示邮箱。

## 前置依赖

### Supabase（必需）

Supabase 是本系统的身份和数据库来源，不再是可选的。

1. 创建 Supabase 项目。
2. 在 SQL Editor 执行 `supabase/migrations/202607230001_initial_schema.sql`。
3. 在 Authentication 中创建老师账号，内部认证地址格式为 `账号名@teachers.lumist.internal`，并开启 Auto Confirm User。
4. 将项目 URL 和 Publishable Key 写入 `.env.local`。
5. 执行 `supabase/migrations/202607270001_multi_teacher_profiles.sql`。
6. 在 `teacher_configs` 表中配置老师的公开名称、头衔、简介、结构化介绍、授课科目、头像和二维码。
7. 重启本地开发服务。

### AI 配置

```bash
OPENAI_API_KEY=你的OpenAI API Key
OPENAI_MODEL=gpt-5-mini
```

## 同步飞书教师账号

教师资料来自飞书多维表格。同步脚本会读取当前教师视图，校验姓名、英文名、科目、简介和职业照，使用英文名生成稳定账号，并把教师资料与照片写入 Supabase。已有账号只更新资料，不重置密码；新账号默认使用 `123456`，可通过本地环境变量 `TEACHER_INITIAL_PASSWORD` 覆盖。

先执行只读预览：

```bash
npm run teachers:preview
```

在 `.env.local` 中配置 `NEXT_PUBLIC_SUPABASE_URL` 和仅供本地使用的 `SUPABASE_SERVICE_ROLE_KEY` 后执行同步：

```bash
npm run teachers:sync
```

新账号凭据会写入 Git 忽略的 `.teacher-sync/` 目录，文件权限为仅当前用户可读。脚本不打印密码，也不会重置已有账号密码。飞书资料存在质量警告时会阻止写入，应优先修正源数据。

统一重置所有教师密码：

```bash
npm run teachers:reset-passwords
```

## Vercel 部署

1. 将本目录推送到 GitHub 仓库。
2. 在 Vercel 新建项目并导入仓库。
3. 将 Root Directory 设置为本目录。
4. 配置环境变量：`OPENAI_API_KEY`、`OPENAI_MODEL`、`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`。
5. 部署并使用 Vercel Preview URL 测试。
6. 测试通过后绑定正式域名。

## 当前能力

### 第二版（当前）

- 老师账号名密码登录（Supabase Auth，预创建账号、无需注册）
- 支持 31 个科目编码：SAT 数学、SAT 英语，以及 29 个 AP 学科
- 科目感知的 AI 提示词构建与报告生成
- AI 异常时本地科目兜底
- 当前教师公开资料（名称、头像、简介、二维码）
- 浏览器导出 PDF
- 教师工作台页面（登录/登出）
- 报告保存、历史列表、重新打开和更新
- 学生总结与课程规划人工编辑
- 老师修改密码

### 下一阶段

- 管理员配置老师信息、品牌素材
- 服务端 PDF 生成与 Supabase Storage 保存
- 管理员跨老师查看、筛选和统计历史报告
- 公司/品牌配置后台

## 开发

```bash
# 测试
node --experimental-strip-types --test test/*.test.mjs

# 构建验证
npm run build
```

## 项目结构

```
app/
  api/
    me/route.ts        # 当前教师公开资料
    generate-report/   # AI 报告生成
    reports/           # 报告 CRUD
  page.tsx             # 登录门禁 / 工作台
components/
  LoginForm.tsx        # 登录表单
  Workspace.tsx         # 工作台外壳
lib/
  auth/current-user.ts # 认证状态检查
  subjects/
    catalog.js         # 科目目录（服务端 + 浏览器共享）
    catalog.d.ts       # 科目类型声明
    prompt.ts          # 科目感知 AI 提示词
  teachers/public-profile.ts  # 教师公开资料
  supabase/            # Supabase 客户端
public/report/
  catalog.js           # 浏览器端科目目录副本
  report-domain.js     # 浏览器端领域函数
  index.html           # 报告页面
  app.js               # 报告页面逻辑
  styles.css           # 报告页面样式
test/
  subject-catalog.test.mjs  # 科目目录测试
test/
  course-plan-editor.test.mjs  # 课程规划编辑器测试
```
