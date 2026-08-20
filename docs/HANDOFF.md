# 路觅教育试听课报告生成器交接文档

> 本文件保留为 2026-07-24 的历史记录，内容已经过期。当前技术交接与重新部署说明请阅读 [`TECHNICAL_HANDOFF.md`](./TECHNICAL_HANDOFF.md)。

更新时间：2026-07-24  
当前阶段：多科目老师工作台第二版
生产地址：https://lumist-trial-report.vercel.app/  
GitHub：https://github.com/monomomo/lumist-trial-report  
主分支：`main`

## 1. 产品目标

这是一个纯老师端的试听课报告生成工具。老师完成试听课后，输入学生基本信息和自然语言课堂反馈，系统调用大模型生成家长版学情报告、详细课程规划和内部销售跟进话术，老师确认后通过浏览器导出 PDF。

当前已覆盖 SAT 数学、SAT 英语、AP Calculus AB、AP Calculus BC、AP Computer Science A、AP Microeconomics、AP Macroeconomics 共 7 个科目。SAT 数学的报告模板和品牌展示完成度最高。

已确认的产品边界：

- 不做学生端
- 不做语音总结
- 不做课前备课
- 第一版使用老师自然语言反馈
- 教师资料、二维码、公司数据和高分案例属于预配置内容
- 使用管理员预创建的账号名和密码登录，不开放自主注册

## 2. 当前用户流程

1. 老师使用管理员预创建的账号名和密码登录
2. 选择科目并填写学生姓名、当前成绩、目标成绩、考试日期
3. 输入自然语言试听课反馈
4. 点击 AI 生成报告
5. 在结构化编辑器中检查和修改课程规划
6. 应用修改并保存报告
7. 查看家长版报告和内部销售跟进卡
8. 使用浏览器打印功能导出 PDF

如果 AI 接口失败，前端会使用本地规则生成兜底版报告，并明确显示“本地兜底版 · AI 暂不可用”。

## 3. 已上线功能

### 3.1 AI 报告生成

接口：`POST /api/generate-report`

实现文件：`app/api/generate-report/route.ts`

当前能力：

- OpenAI Responses API
- Zod Structured Outputs
- 默认模型 `gpt-5-mini`
- 输入最长 6000 字
- 输出家长版报告、课程规划和销售跟进话术
- 自动计算课程规划总课时
- 支持 0.5h、1h、1.5h、2h 的单次课时
- AI 调用最长等待 240 秒
- Vercel Function 最大执行时间 300 秒
- SDK 自动重试关闭，避免一次生成重复执行
- Supabase 已配置时，接口要求老师处于登录状态
- Supabase 未配置时自动进入本地 Demo 模式

### 3.2 多科目支持

系统目前支持 7 个科目，并根据科目切换输入提示、报告文案、课程规划规则和本地兜底内容：

- SAT 数学
- SAT 英语
- AP Calculus AB
- AP Calculus BC
- AP Computer Science A
- AP Microeconomics
- AP Macroeconomics

相关实现：

- `lib/subjects/catalog.js`
- `lib/subjects/prompt.ts`
- `public/report/catalog.js`
- `public/report/report-domain.js`

### 3.3 Digital SAT 专业约束

系统提示词已经限制：

- 数学共 44 题、70 分钟
- 两个各 35 分钟的自适应 Module
- 数学全程可使用计算器
- 内置 Desmos
- 只覆盖四大 Domain
- 禁止旧版“无计算器部分/有计算器部分”表述
- 禁止把排列组合、函数复合、反函数等非官方核心内容随意加入规划
- Bluebook 诊断必须按数字化考试描述

课程规划主题会做标题完整性清理，未闭合括号和残缺结尾会被规范化。

### 3.4 家长版语言保护

已针对老师反馈过于简略的情况增加三层保护：

1. 模型提示词禁止暴露输入质量和字段缺失
2. 服务端扫描不适合家长展示的表达
3. 根据信息完整度强制使用安全模板

家长版禁止或自动替换的典型表达：

- 老师原始记录
- 老师只写了
- 老师未提供
- 未列出
- 信息不足
- 无法判断
- 未能获得
- 没有完整记录
- 未提供可量化数据
- 不构成正式能力评估

如果老师只写“今天讲了代数”，系统不会擅自补充方程、不等式等具体考点，也不会评价学生正确率或课堂表现。

老师端会显示一条不进入 PDF 的信息完整度提醒，例如：

> 当前课堂记录较为简略，家长版已采用保守表达。建议补充具体考点或课堂练习、学生课堂表现或作答情况，以生成更有针对性的报告。

### 3.5 动态课程规划与人工编辑

课程规划数据结构：

```text
coursePlan
├── totalHours
├── rationale
└── stages[]
    ├── title
    ├── description
    └── lessons[]
        ├── duration
        ├── theme
        ├── content
        ├── goal
        └── difficulty
```

实现文件：`public/report/app.js`

老师可以在 AI 生成后进入结构化课程规划编辑器：

- 编辑阶段名称、阶段说明、课时时长、主题、内容、目标和重难点
- 新增、复制、删除和上下移动课时
- 折叠或展开阶段
- 自动重新计算总课时
- 应用修改后更新报告并重新动态分页
- 放弃修改或恢复 AI 原始规划
- 编辑结果继续以结构化数据为准，不直接修改打印 DOM

当前分页机制：

- 不再按“一个阶段一页”强制分页
- 使用隐藏的 A4 测量容器计算实际内容高度
- 相邻阶段可以出现在同一页
- 单个课时不被截断
- 自动均衡各页课时数量
- 最后一页保留动态调整原则
- 页面序号自动更新
- 阶段名称使用课时内容区内的短金色竖线标签
- 已取消横穿整张表格的黄色阶段行

已验证：

- 13 个详细课时可排为 2 页，分布约为 7 + 6
- 20 个课时、6 个阶段可排为约 3 页
- 不产生单课时尾页和大面积无意义空白

### 3.6 PDF 导出

导出方式：浏览器 `window.print()`

打印规则：

- A4，210mm × 297mm
- 每个 `.report-page` 固定一页
- 打印时隐藏侧边栏、顶部操作区、销售卡和老师端提醒
- 只打印 `#report-view`
- 移动端媒体查询不会污染打印布局
- 最后一页不会额外产生空白页

曾出现并已修复的问题：

- 打印了新建报告和历史记录隐藏视图，导致多余页面
- A4 宽度误触发移动端样式，导致教师页错位
- 最后一页 `break-after` 未重置，产生尾部空白页

### 3.7 老师登录、教师资料与报告保存

- 老师端使用账号名密码登录，后台映射为 Supabase Auth 内部认证地址
- 老师账号由管理员预先创建，不提供注册入口
- `/api/me` 返回当前老师公开资料
- `teacher_configs` 可配置老师名称、头衔、简介、头像和二维码
- 报告生成后可通过 `/api/reports` 保存到 Supabase
- 未配置 Supabase 时进入 Demo 模式，不要求登录，也不执行真实云端保存

### 3.8 报告页面结构

当前家长版 PDF 顺序：

1. 封面页
2. 学生信息与试听课总结
3. 动态课程规划，页数根据内容变化
4. 任课教师
5. 2026 SAT 最新高分战绩
6. 路觅数据
7. 结尾页

另有不进入家长版 PDF 的销售跟进卡。

## 4. 当前视觉与素材

报告主色：明黄色、白色、深色文字。

主要素材目录：`public/report/assets/`

重要文件：

- `lumist-cover-page.png`：封面
- `lumist-closing-page.png`：结尾页
- `lumist-data-page-6.png`：路觅数据页
- `amber-photo.png`：Amber 老师照片
- `amber-qr.png`：Amber 老师二维码
- `sat-high-score-cards-hd.png`：SAT 高分成绩卡

Amber 是教师资料缺失或 Demo 模式下的默认展示。正式登录后，前端通过 `/api/me` 读取当前老师在 `teacher_configs` 中的公开资料；未配置个人资料时会使用系统默认资料。

## 5. 技术架构

### 5.1 主要技术栈

- Next.js 15.5.21
- React 19.1.1
- TypeScript 5.9
- OpenAI Node SDK 6.48
- Zod 4.4
- Supabase Auth + Database
- Vercel 部署

### 5.2 页面结构

`app/page.tsx` 先检查 Supabase 认证状态：已登录时渲染 `components/Workspace.tsx`，未登录时渲染老师登录页，Supabase 未配置时进入 Demo 工作台。

Workspace 通过 iframe 加载：

```text
/report/index.html
```

报告主体目前仍是原生 HTML、CSS 和 JavaScript：

- `public/report/index.html`
- `public/report/styles.css`
- `public/report/app.js`

### 5.3 关键数据流

```text
老师自然语言反馈
→ POST /api/generate-report
→ 校验 Supabase 登录与系统配置状态
→ OpenAI Structured Output
→ 服务端专业规则与家长版语言清理
→ currentReportData
→ renderReport
→ renderCoursePlan
→ A4 动态分页
→ 老师结构化编辑课程规划
→ POST /api/reports 保存
→ 浏览器导出 PDF
```

`currentReportData` 是前端当前报告的数据源。课程规划编辑器使用独立草稿，应用后回写 `currentReportData` 并重新渲染；不要绕过这一数据流直接修改打印表格 DOM。

## 6. 环境变量

`.env.example` 当前包含：

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
OPENAI_MODEL
NEXT_PUBLIC_APP_URL
```

当前生产必须配置：

- `OPENAI_API_KEY`
- `OPENAI_MODEL=gpt-5-mini`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

安全要求：

- 不得将真实 API Key、密码或其他敏感信息写入 GitHub
- `OPENAI_API_KEY` 只能存在于服务端环境变量
- Supabase Publishable Key 可以暴露给浏览器，但 Service Role Key 不可以
- `SUPABASE_SERVICE_ROLE_KEY` 当前业务未使用，不应无必要地配置到生产环境

## 7. Supabase 当前状态

Supabase 已作为正式身份和数据库方案接入。生产环境是否实际生效，取决于 Vercel 是否配置正确的 Supabase URL 和 Publishable Key，以及目标 Supabase 项目是否执行 migration。

已有内容：

- `lib/supabase/client.ts`
- `lib/supabase/server.ts`
- `lib/supabase/config.ts`
- `components/LoginForm.tsx`
- `supabase/migrations/202607230001_initial_schema.sql`
- `app/api/reports/route.ts`

Migration 已定义：

- profiles
- reports
- teacher_configs
- company_configs
- RLS 策略
- teacher-assets Storage bucket
- report-pdfs Storage bucket

实际状态：

- `app/page.tsx` 已接入登录门禁
- `components/LoginForm.tsx` 使用 Supabase 邮箱密码登录
- `app/api/me/route.ts` 提供当前教师公开资料
- `app/api/reports/route.ts` 支持报告列表查询和新增保存
- `app/api/generate-report/route.ts` 必须通过 Supabase 登录校验才能调用 AI
- 未配置 Supabase 时，工作台进入 Demo 模式，生成接口返回系统未配置并由前端使用本地兜底报告，reports API 不执行真实保存
- 前端已有保存当前报告的能力
- 历史报告列表、详情读取和再次编辑尚未形成完整产品闭环

## 8. 尚未完成

### 8.1 登录与数据闭环验收

代码层面已经接入 Supabase，但仍需要在生产环境完成或确认：

- 执行 migration
- 由管理员创建老师邮箱密码账号
- 为每位老师补齐 `teacher_configs`
- 验证不同老师只能访问自己的报告
- 验证头像和二维码在浏览器及 PDF 中均正确显示
- 增加密码重置或管理员重置流程说明

### 8.2 历史报告闭环

当前可以新增保存报告，但尚缺少：

- 真实历史报告列表界面
- 按报告 ID 读取详情
- 再次打开、编辑和保存
- 草稿、已完成等状态管理
- 删除或归档报告的产品规则

### 8.3 其他未完成功能

- 管理员后台
- 服务端生成 PDF
- PDF 云端保存
- 品牌与公司资料后台配置
- 更完整的端到端测试
- 7 个科目的真实教师反馈回归测试与模板精修

## 9. 已知限制与风险

1. Supabase 未配置时会静默进入 Demo 模式，部署验收时必须确认不是误把 Demo 当成正式环境。
2. 当前历史报告界面尚未与真实报告读取形成完整闭环。
3. 报告保存失败不会影响浏览器当前内容，但跨设备无法恢复未成功保存的数据。
4. AI 输出虽然有结构化约束和服务端清理，仍需持续积累不同科目的真实老师输入做回归测试。
5. 课程规划主题可能因模型输出长度限制出现残缺，服务端已有基础标题规范化，但仍应关注。
6. 浏览器打印结果依赖 Chrome 类浏览器，建议老师统一使用最新版 Chrome。
7. 已有科目目录和课程规划编辑器单元测试，但尚无完整端到端测试。
8. `SUPABASE_SERVICE_ROLE_KEY` 已出现在 `.env.example` 中，但目前业务代码没有使用；未来使用时必须限制在服务端。
9. 源码中仍有少量历史内联注释，与当前“新增代码不写注释”的项目规范不一致；后续修改时不要继续增加。

## 10. 本地开发

```bash
npm install
cp .env.example .env.local
npm run dev
```

访问：

```text
http://localhost:3000/
```

构建检查：

```bash
node --check public/report/app.js
node --experimental-strip-types --test test/*.test.mjs
git diff --check
npm run build
```

API 测试示例：

```bash
curl -X POST http://localhost:3000/api/generate-report \
  -H 'content-type: application/json' \
  --data '{
    "studentName":"测试学生",
    "currentScore":"",
    "targetScore":"750+",
    "examDate":"",
    "teacherNotes":"学生课堂互动积极，代数基础较好，几何和概率需要进一步恢复。",
    "subjectCode":"sat_math"
  }'
```

这个接口始终要求请求携带有效的登录 Cookie；未配置 Supabase 的本地 Demo 环境会返回系统未配置，由前端生成本地兜底报告。

## 11. 部署流程

GitHub 主分支推送后，Vercel 自动部署。

Git 配置：

```text
user.name = monomomo
user.email = ljyyass1231@gmail.com
```

部署状态可通过 GitHub commit status 检查：

```bash
gh api repos/monomomo/lumist-trial-report/commits/COMMIT_SHA/status --jq '.state'
```

上线后至少验证：

1. 未登录用户进入登录页
2. 正确老师账号可以登录，错误密码显示友好提示
3. 登录老师的照片、简介和二维码正确
4. 7 个科目均能提交生成
5. 简略反馈不会生成家长版免责声明
6. 详细反馈不会被安全模板过度覆盖
7. 课程规划可编辑，总课时等于所有课时 duration 之和
8. 保存成功后 Supabase 中的 `teacher_id` 与当前老师一致
9. 老师 A 无法读取老师 B 的报告
10. PDF 无多余页面、截断和教师页错位

## 12. 最近关键提交

```text
9ce1c57 fix
3b7a98b 登录功能
e941e7b 老师编辑 AI 生成的课程规划
a122273 style: polish sparse feedback copy
6109c59 fix: guard sparse teacher feedback
43ed3a4 fix: improve parent-facing report language
d3920f6 style: simplify course plan stage labels
6fe5954 feat: dynamically pack course plan pages
b964c04 fix: align AI plans with digital SAT format
3c14ac0 fix: prevent AI report generation timeout
f951ed8 fix: correct PDF pagination and teacher layout
8697a21 feat: generate SAT reports with OpenAI
```

## 13. 建议的后续开发顺序

1. 完成生产 Supabase 配置并用两个真实老师账号做权限隔离验收
2. 补齐老师配置数据，逐一核对照片、二维码和 PDF
3. 完成真实历史报告列表、详情读取和再次编辑闭环
4. 用每个科目至少 10 份真实老师反馈做 AI 文案回归测试
5. 补充登录、生成、编辑、保存、打印的端到端测试
6. 再开发管理员后台、品牌配置和服务端 PDF

## 14. 交接验收基线

接手开发前应确保：

- Git 工作区干净
- `node --experimental-strip-types --test test/*.test.mjs` 通过
- `npm run build` 通过
- 生产地址可访问
- 当前 main 分支部署成功
- 不在代码和文档中写入真实密钥、密码或其他敏感信息
- 登录、教师资料读取和报告保存已在目标 Supabase 项目验证
- 修改课程规划模板后必须重新导出并逐页检查 PDF
- 删除任何文件前必须获得项目负责人确认
