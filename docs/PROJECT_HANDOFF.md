# 路觅教育试听课报告系统交接总览

更新时间：2026-08-19  
生产地址：https://lumist-trial-report.vercel.app/  
代码仓库：https://github.com/monomomo/lumist-trial-report  
主分支：`main`

> 本文用于帮助接手团队快速判断项目现状和接手优先级。完整代码结构、数据库说明、部署步骤和验收清单见 [`TECHNICAL_HANDOFF.md`](./TECHNICAL_HANDOFF.md)。旧的 [`HANDOFF.md`](./HANDOFF.md) 仅保留为历史记录，不应继续作为部署依据。

## 1. 一句话结论

项目已经是可实际使用的老师端试听课报告系统：老师可通过账号密码登录，填写课堂反馈，生成多学科 AI 学情报告，人工编辑总结和课程规划，保存历史报告，并通过浏览器导出 PDF。

当前适合由公司技术团队接手、重新部署和继续维护，但不应把它理解成完整的教务系统。它没有管理员后台、学生端、服务端 PDF 文件管理和自动化教师资料审批流程。

## 2. 产品范围

### 已确定的产品定位

- 仅面向路觅老师使用，不开放学生或家长登录。
- 老师账号由管理员预创建，不提供自主注册。
- 输入以老师的自然语言试听课记录为主。
- 输出包括家长版学情诊断、课程规划、教师介绍、品牌介绍和内部销售跟进话术。
- 家长版报告以老师本人视角表达，专业术语保留英文或中英结合。
- PDF 通过浏览器打印导出，不在服务器生成 PDF 文件。

### 当前主流程

1. 老师使用账号名和密码登录。
2. 选择可搜索的科目。
3. 填写学生姓名、成绩、考试日期、总课时和试听课反馈。
4. 在生成前检查清单中确认输入完整度。
5. 调用 OpenAI 生成结构化报告。
6. 查看生成后质量提示。
7. 人工修改“学生信息与试听课总结”或课程规划。
8. 保存为历史报告，后续可重新打开和更新。
9. 导出 PDF，文件名格式为“学生姓名+科目+学情报告”。

## 3. 已完成的功能

### 3.1 登录与老师账号

- Supabase Auth 账号密码登录。
- 页面只展示账号名，不展示内部邮箱。
- 内部认证地址格式：`username@teachers.lumist.internal`。
- 登录、退出登录、修改密码功能已完成。
- 密码修改规则为至少 6 位并同时包含字母和数字。
- 未登录访问 `/api/me` 和 `/api/reports` 返回 `401`。
- 当前不开放老师自主注册和找回密码邮件。

### 3.2 教师资料

- 每位老师可配置公开姓名、职称、简介、结构化经历、授课科目、职业照和二维码。
- 报告教师介绍页自动展示当前登录老师资料。
- 保存报告时会保存老师资料快照，历史报告不会因老师后来改资料而改变。
- 已从飞书多维表格同步老师资料、职业照和已有二维码。
- 已删除教师介绍页中的“语言能力”展示。
- 长简介会按完整句压缩，避免以省略号或半句话结尾。
- 缺少照片时使用姓名占位；缺少简介时显示“导师详细介绍待补充”，不会虚构履历。

### 3.3 报告生成

- 使用 OpenAI Responses API 和 Zod Structured Outputs。
- 默认模型：`gpt-5-mini`，可通过 `OPENAI_MODEL` 修改。
- 单次请求最长等待 240 秒，Vercel Function 配置最长 300 秒。
- 输入校验覆盖学生姓名、成绩、总课时、课堂记录长度和科目编码。
- AP 科目目标分未填写时自动使用 5 分。
- AP 考试日期默认下一年 5 月，并可选择更晚年份。
- 总课时由老师决定，支持 2–60 小时和 0.5 小时间隔。
- 服务端预先计算课时槽位，AI 不能擅自改变总课时。
- AI 输出不合格时允许一次定向修复；非结构性问题以质量警告展示，不再轻易让整份报告失败。

### 3.4 科目支持

当前共支持 31 个科目编码：

- SAT 数学、SAT 英语。
- AP Calculus AB、AP Calculus BC、AP Precalculus。
- AP Physics 1、AP Physics 2、AP Physics C Mechanics、AP Physics C Electricity and Magnetism。
- AP Chemistry、AP Biology、AP Statistics。
- AP Computer Science A、AP Computer Science Principles。
- AP Microeconomics、AP Macroeconomics。
- AP United States History、AP World History、AP European History。
- AP Psychology、AP Human Geography。
- AP Comparative Government and Politics、AP United States Government and Politics。
- AP English Literature and Composition、AP English Language and Composition。
- AP Art History、AP Environmental Science。
- AP Chinese Language and Culture、AP Seminar、AP Latin、AP Music Theory。

科目目录在服务端和报告 iframe 各有一份：

- `lib/subjects/catalog.js`
- `public/report/catalog.js`

两份目录必须同步修改，测试会检查编码覆盖和重复。

### 3.5 提示词和质量控制

- 每个科目有独立模块、考试事实和内容边界。
- 有跨科目污染检测，例如 AB 不允许混入 BC 专属内容，微观经济和宏观经济互相隔离。
- AP Precalculus 可以说明与 Calculus、SAT 数学的衔接，但不能把微积分或 SAT 专项训练写成本课程内容。
- 家长版禁止暴露“原始记录、信息不足、待老师确认、报告整理”等生成过程。
- 家长版使用“我会……”的老师本人视角，避免第三者描述老师。
- 课程规划要求具体教学任务、练习证据和可检查的课后目标，减少模板化和 AI 味。
- 专业术语按中英结合表达，不强行把所有内容翻译成中文。

### 3.6 人工编辑

- “学生信息与试听课总结”可结构化编辑并应用到报告。
- 课程规划可编辑阶段、课时、主题、内容、目标和重难点。
- 支持新增、复制、删除、排序课时和移动课时到其他阶段。
- 编辑器支持内部滚动，长内容不会被窗口截住。
- 应用修改后会同步到页面、历史报告和 PDF 数据。

### 3.7 历史报告

- `/api/reports` 支持当前老师自己的报告列表、打开、创建和更新。
- 数据库 RLS 限制老师只能访问自己的报告。
- 保存时校验学生信息、成绩范围、总课时和课程规划结构。
- 报告保存老师资料快照。
- 当前没有跨老师查看、管理员查询、筛选统计或恢复已删除报告的后台。

### 3.8 页面和 PDF

- PDF 使用 `window.print()` 和 A4 打印样式。
- 课程规划按实际高度测量分页，不再一条规划占一页。
- 单条课时不跨页，尾页会做课时均衡。
- 学生总结页会根据内容密度压缩和分页。
- 报告页眉 Logo 的尺寸和位置统一。
- 封面不再叠加旧黄色装饰环。
- SAT 与 AP 使用不同封面、封底和高分案例素材。
- 报告末尾固定顺序：高分案例 → 公司介绍 → 课程介绍 → 封底。
- PDF 名称格式：`学生姓名+科目+学情报告.pdf`。

## 4. 当前教师数据状态

截至 2026-08-19，系统采用以下数据关系：

- 飞书老师表是教师资料源。
- Supabase Auth 保存登录账号。
- `profiles` 保存账号角色和展示名。
- `teacher_configs` 保存报告中的公开教师资料。
- Supabase Storage 私有 bucket `teacher-assets` 保存职业照和二维码。

最近一次全量核验结果：

- 飞书当前老师记录：34 位。
- Supabase 已有 31 位当前飞书老师账号，另有 3 位最新新增老师尚未创建账号。
- Supabase 保留账号和配置：32 位，其中 `Christina Chen` 是不在当前飞书视图中的历史账号。
- Supabase 当前已配置职业照：当前老师 28 位；飞书已经为连楚楚、郎峻墨、王艺欣补充职业照，但尚未执行本轮同步。
- 已配置二维码：20 位；没有二维码时报告页自动隐藏二维码区域。
- 49 个已配置图片素材已逐一验证可通过签名 URL 读取，没有损坏文件。

已知源数据缺口：

- 连楚楚 / Tracy Lian：飞书已补职业照，待同步；仍缺二维码。
- 郎峻墨 / Jeffery Lang：账号 `jefferylang`，资料和 6 项科目已同步；飞书已补职业照，待同步；仍缺二维码。
- 王艺欣 / Victoria Wang：飞书已补简介和职业照，待同步；授课科目仍为空，二维码仍缺失。
- 黄钰琪 / Yuki Huang：飞书资料完整，待创建账号 `yukihuang`。
- 段嘉皓 / Stephen Duan：飞书资料完整，待创建账号 `stephenduan`。
- 刘冰瀚 / Louis Liu：待创建账号 `louisliu`；飞书暂缺职业照。
- 另有其他老师暂缺二维码，具体名单应以 `npm run teachers:preview-qr` 的实时输出为准。

不要为了让页面看起来完整而编造老师照片、履历、授课年限或成绩。应先在飞书补充，再运行同步。

## 5. 目前没有做的功能

### 明确未实现

- 管理员管理后台。
- 页面内创建、停用或删除老师账号。
- 老师自主注册。
- 邮箱找回密码或短信验证码。
- 学生端和家长端。
- 多校区、多公司或多品牌租户。
- 服务端生成和保存 PDF。
- PDF 下载历史和云端 PDF 文件管理。
- 报告审批流、老师提交审核和管理员退回。
- 管理员跨老师查看所有历史报告。
- 报表统计、使用量统计和销售转化分析。
- 飞书变化自动触发同步；当前仍需人工运行脚本。
- 职业照和二维码的后台上传页面。
- 完整端到端浏览器自动化测试。

### 有代码或数据库基础，但未形成完整产品

- `company_configs` 表已存在，但品牌素材主要仍来自 `public/report/assets/`，没有公司配置后台。
- `report-pdfs` Storage bucket 已在初始迁移中定义，但当前 PDF 仍由浏览器打印，没有上传流程。
- 历史报告已有 CRUD，但没有管理员视角和复杂检索。

## 6. 技术架构

### 主要技术栈

- Next.js 15.5.21
- React 19.1.1
- TypeScript 5.9
- OpenAI Node SDK 6.48
- Zod 4.4
- Supabase Auth、Postgres、RLS 和 Storage
- Vercel

### 关键目录

```text
app/
  api/generate-report/route.ts  AI 报告生成
  api/me/route.ts               当前老师公开资料
  api/reports/route.ts          历史报告 CRUD
  page.tsx                      登录门禁和工作台入口
components/
  LoginForm.tsx                 登录
  Workspace.tsx                 老师工作台
  ChangePasswordDialog.tsx      修改密码
lib/
  auth/                         账号映射和认证状态
  reports/schema.ts             历史报告保存校验
  subjects/                     科目目录、提示词、范围和质量规则
  teachers/public-profile.ts    教师资料与历史快照
  supabase/                     浏览器和服务端客户端
public/report/
  index.html                    报告 iframe 页面
  app.js                        表单、编辑、历史、打印主逻辑
  styles.css                    页面和打印样式
  assets/                       封面、封底、页眉、案例和介绍页
scripts/
  sync-feishu-teachers.mjs      飞书教师同步
supabase/migrations/            数据库迁移
test/                           自动化测试
```

## 7. 环境变量

Vercel 运行所需：

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-mini
NEXT_PUBLIC_APP_URL=
```

本地教师同步额外需要：

```bash
SUPABASE_SERVICE_ROLE_KEY=
TEACHER_INITIAL_PASSWORD=
FEISHU_PROFILE=
LARK_CLI_PATH=
FEISHU_TEACHER_BASE_TOKEN=
FEISHU_TEACHER_TABLE_ID=
FEISHU_TEACHER_VIEW_ID=
```

安全要求：

- `SUPABASE_SERVICE_ROLE_KEY` 只能放在受控本地环境或受保护的服务端环境，绝不能进入浏览器变量、Git 或普通文档。
- `.teacher-sync/` 可能包含初始账号密码 CSV，已经被 Git 忽略，不属于代码交付物。
- `.env.local` 不提交 Git。
- Vercel 环境变量需要同时配置 Production、Preview 和 Development 时，应分别确认作用范围。

## 8. 部署和数据库

### 推荐接手方案

优先采用“新 Vercel 项目 + 复用现有 Supabase”：可以保留全部老师账号、教师资料和历史报告，迁移风险最低。

如果必须新建 Supabase：

1. 执行 `supabase/migrations/202607230001_initial_schema.sql`。
2. 执行 `supabase/migrations/202607270001_multi_teacher_profiles.sql`。
3. 配置 Auth、Storage、RLS 和环境变量。
4. 重新同步老师账号和资料。
5. 单独迁移历史报告；仅重新创建账号会改变 user ID，不能直接假设旧报告仍能关联。

### 上线前必须验证

```bash
npm install
node --test test/*.test.mjs
npm run build
```

线上至少验证：

- 四类老师账号可登录：有照片二维码、只有照片、都没有、资料不完整。
- `/api/me` 返回当前登录老师，而不是固定 Amber。
- 生成一份 2 小时 AP 报告和一份较长总课时报告。
- 人工修改总结和课程规划后可以保存、重新打开。
- 导出 PDF 不截断、无空白尾页、文件名正确。
- 老师 A 无法读取老师 B 的历史报告。

## 9. 教师资料运维

### 新增老师

先只读预览：

```bash
npm run teachers:preview-new
```

确认用户名和资料后创建缺失账号：

```bash
npm run teachers:sync-new
```

### 更新全部老师资料

```bash
npm run teachers:preview
npm run teachers:sync
```

如果飞书确实存在可接受的照片、科目或简介缺口，默认同步会被警告拦截。确认占位策略可接受后才能显式执行：

```bash
npm run teachers:sync -- --allow-warnings
```

该命令更新展示名和报告资料，不重置现有密码。

### 只同步二维码

```bash
npm run teachers:preview-qr
npm run teachers:sync-qr
```

二维码专项同步只更新已有账号，不创建账号，也不会把空二维码覆盖成 `null`。

### 密码处理

老师可在工作台修改密码。管理员统一重置密码会影响所有老师，应谨慎执行：

```bash
npm run teachers:reset-passwords
```

## 10. 重点实现细节

### iframe 架构

Next.js 负责认证和外层工作台，报告主体是 `public/report/index.html` iframe。修改登录、API 或工作台看 `app/` 和 `components/`；修改报告页面、编辑器和打印通常看 `public/report/`。

### 教师资料必须服务端解析

报告保存时不能相信前端传来的教师资料，服务端会根据登录用户读取教师配置并生成快照。不要改成让前端直接提交任意老师介绍，否则会造成越权和历史数据污染。

### 总课时不能交给 AI 决定

服务端先根据老师填写的总课时生成固定课时槽位，再把时长附回 AI 内容。AI 只负责每节课内容，不负责增减总课时。修改生成逻辑时必须保留这条约束。

### 科目污染保护

科目边界由目录、提示词和服务端范围检查共同实现。新增科目不能只加下拉选项，还要补齐模块、提示词、范围规则、兜底规划和测试。

### PDF 依赖浏览器布局

PDF 不是后端文件。任何 CSS、字体、图片比例、编辑器结构或页面 DOM 修改，都可能影响打印结果。不能只看网页，需要实际使用 Chrome 打印预览验证。

### 历史报告使用教师快照

新报告显示最新老师资料，历史报告显示保存时快照。这是产品设计，不是数据不同步。修改老师资料后，不应批量篡改历史报告。

## 11. 已知风险与技术债

### P0：交接和重新部署前

- 同步脚本仍包含原开发机 `lark-cli` 路径和飞书 token 默认值，应改为缺少环境变量就报错。
- 确认公司拥有 GitHub、Vercel、Supabase、OpenAI 和飞书 Base 的正式管理员权限。
- 通过安全渠道移交密钥和账号清单，不要写入本交接文档。
- 明确 `Christina Chen` 历史账号是保留、停用还是迁回飞书；删除前必须确认历史报告关联。

### P1：稳定性

- 增加 Playwright 端到端测试，覆盖登录、生成、编辑、保存、历史打开和打印。
- 为 OpenAI 失败、Vercel 超时和 Supabase 错误接入结构化日志及告警。
- 为飞书同步增加机器无关配置和可重复的审计报告。
- 处理 `package.json` 未声明 ESM 导致测试出现 `MODULE_TYPELESS_PACKAGE_JSON` 警告的问题。

### P2：产品完善

- 管理员后台和老师资料审批。
- 跨老师历史报告检索及运营统计。
- 服务端 PDF 生成、归档和下载。
- 更完善的报告草稿、审核和版本记录。

## 12. 最近一次核验

截至 2026-08-19 已完成：

- 飞书当前有 34 位老师；其中 31 位存在对应账号，最新新增的 Yuki Huang、Stephen Duan 和 Louis Liu 尚未创建账号。
- 已有 31 位老师的姓名、账号元数据、简介、分段、科目、照片和二维码曾执行全量同步；飞书之后补充的 3 张职业照和最新简介尚待下一轮同步。
- Bill Wang 的展示名已与飞书一致。
- Jeffery Lang 账号和资料存在；飞书已补职业照但 Supabase 尚待同步，二维码仍为空。
- 29 个 `teacher_configs` 有职业照路径，其中包含 1 个历史账号；当前飞书老师实际有职业照 28 位。
- 20 个配置有二维码。
- 已配置的 49 个图片素材均能正常读取。
- 线上首页返回 `200`；未登录访问受保护 API 返回 `401`；错误请求方法返回 `405`。

完整上线前仍建议由接手团队使用真实浏览器完成一次登录、生成、保存和 PDF 全链路验收。线上 AI 生成会产生实际 API 成本，不应在无记录的情况下反复压测。

## 13. 交接时需要单独移交的内容

以下内容不能放进 Git，需通过公司的密码管理器或受控交接流程移交：

- GitHub 仓库管理员权限。
- Vercel 项目管理员权限和域名配置。
- Supabase 项目管理员权限。
- OpenAI 项目和 API Key。
- 飞书 Base 访问权限及公司 `lark-cli` 授权方式。
- 老师账号清单和临时密码。
- 生产环境变量清单。

## 14. 接手团队首周建议

1. 克隆仓库，跑完整测试和生产构建。
2. 在 Preview 环境完成登录、生成、编辑、保存和 PDF 验收。
3. 核对 Supabase RLS 和 Storage 私有访问。
4. 把教师同步脚本改为完全依赖环境变量。
5. 明确历史账号处理策略和教师资料负责人。
6. 接入错误日志与告警。
7. 再切换正式 Vercel 项目或域名。
