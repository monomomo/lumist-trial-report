# 路觅教育试听课报告生成器：技术交接与重新部署指南

更新时间：2026-08-03  
交接基线：`main` 分支，`62fa1ac` 及之后的交接文档提交  
生产地址：https://lumist-trial-report.vercel.app/  
代码仓库：https://github.com/monomomo/lumist-trial-report

## 1. 交接结论

这是一个面向路觅老师的内部试听课学情报告工具。老师使用账号名和密码登录，填写学生信息、科目、总课时与试听课记录，系统调用 OpenAI 生成结构化报告。老师可以继续编辑课程规划、保存历史报告，并通过浏览器导出 PDF。

当前系统已经具备正式使用所需的主链路：

- 老师账号名和密码登录
- 按登录老师展示独立的老师介绍页
- 31 个 SAT/AP 科目的搜索下拉选择
- AI 结构化生成、质量检查与二次修复
- 课程规划总课时精确分配
- 报告编辑、保存、历史列表与再次打开
- 老师本人第一人称口吻的家长版内容
- SAT/AP 品牌封面、高分案例、公司介绍、课程介绍与封底
- PDF 文件名自动生成为“学生姓名+科目+学情报告.pdf”
- 老师自主修改密码
- 从飞书多维表格批量创建或更新老师账号、简介与照片

重新部署前，技术团队必须先决定是否保留当前 Supabase。这个决定会直接影响老师账号、修改后的密码、老师素材和历史报告。

推荐方案是：第一阶段更换 Vercel 项目但继续使用当前 Supabase，完成无损切换；第二阶段如果公司必须把 Supabase 也迁入自己的组织，再安排数据库、Auth 和 Storage 的完整迁移。仅重新执行 SQL 和飞书同步脚本不能迁移历史报告，也不能保留老师自行修改后的密码。

## 2. 系统边界

当前产品是纯老师端内部工具：

- 不开放自主注册
- 不提供学生端或家长端登录
- 不发送邮件
- 不提供忘记密码邮件找回
- 不在服务端生成或保存 PDF
- 不提供管理员网页后台
- 不自动同步老师二维码
- 不支持报告删除或归档界面

账号、老师资料和重置密码等管理操作目前通过 Supabase Dashboard 和本地管理脚本完成。

## 3. 技术栈

| 模块 | 技术 |
| --- | --- |
| Web 框架 | Next.js 15.5.21 App Router |
| UI | React 19.1.1 + 原生 HTML/CSS/JavaScript 报告应用 |
| 语言 | TypeScript 5.9 + JavaScript |
| AI | OpenAI SDK 6.48，Responses API，Structured Outputs |
| 校验 | Zod 4.4.3 |
| 登录与数据 | Supabase Auth、Postgres、RLS、Storage |
| 部署 | Vercel |
| PDF | 浏览器 `window.print()` / Save as PDF |
| 老师资料源 | 飞书多维表格 + `lark-cli` 同步脚本 |

本地最后验证环境为 Node.js 26 和 npm 11。公司部署建议使用 Vercel 当前支持的 Node.js LTS，并以 `npm ci` 和 `npm run build` 的实际结果作为准入条件。

## 4. 代码结构

```text
app/
  api/generate-report/route.ts
  api/me/route.ts
  api/reports/route.ts
  page.tsx
components/
  ChangePasswordDialog.tsx
  LoginForm.tsx
  Workspace.tsx
lib/
  auth/
  reports/
  subjects/
  supabase/
  teachers/
public/report/
  assets/
  app.js
  catalog.js
  index.html
  report-domain.js
  styles.css
scripts/
  sync-feishu-teachers.mjs
supabase/migrations/
test/
docs/
```

需要特别理解两层前端：

1. Next.js 页面负责登录、用户会话、顶部工作台和修改密码。
2. `public/report/` 是通过 iframe 打开的原生报告应用，负责录入、生成、编辑、历史记录展示和打印。

两层之间通过浏览器消息和 Supabase 会话协作。修改登录外壳优先检查 `components/`；修改报告页面、PDF 排版或交互优先检查 `public/report/`。

## 5. 核心业务流程

### 5.1 登录

老师输入账号名和密码。系统会把账号名映射为内部邮箱：

```text
账号名@teachers.lumist.internal
```

该邮箱只是 Supabase Auth 的内部实现，不展示给老师，也不用于收邮件。

相关代码：

- `components/LoginForm.tsx`
- `lib/auth/username.ts`
- `lib/supabase/client.ts`
- `lib/supabase/server.ts`

如果没有配置 Supabase URL 或 publishable key，系统会进入 Demo 模式，跳过正式登录且不会可靠保存历史数据。正式部署验收时必须确认页面出现登录门槛，不能只看到 Demo 工作台。

### 5.2 生成报告

入口：`POST /api/generate-report`

主流程：

1. 验证登录态和请求参数
2. 根据总课时生成合法的单节课时槽位
3. 根据科目加载范围、术语和教学约束
4. 调用 OpenAI Structured Outputs
5. 校验科目范围、老师口吻、课程数量和内容质量
6. 第一次不合格时携带问题列表进行第二次修复
7. 服务端附加每节课时长并返回统一报告结构

关键限制：

- 老师记录长度：20–6000 字
- 总课时：2–60 小时
- 步长：0.5 小时
- AI 请求超时：240 秒
- Vercel 函数最大执行时间：300 秒
- OpenAI SDK 自动重试关闭
- 默认模型：`gpt-5-mini`

相关代码：

- `app/api/generate-report/route.ts`
- `lib/subjects/prompt.ts`
- `lib/subjects/scope.ts`
- `lib/subjects/course-plan-quality.ts`
- `lib/subjects/lesson-slots.ts`
- `lib/reports/schema.ts`

接口常见错误码：

| 错误码 | 含义 |
| --- | --- |
| `INVALID_INPUT` | 输入字段、课时或长度不合法 |
| `UNAUTHORIZED` | 未登录或会话过期 |
| `AI_SERVICE_NOT_CONFIGURED` | 未配置 OpenAI API Key |
| `SUBJECT_SCOPE_VIOLATION` | AI 输出混入其他学科内容 |
| `REPORT_QUALITY_FAILED` | 连续两次未达到质量规则 |
| `AI_GENERATION_FAILED` | AI 请求或响应处理失败 |

部分可恢复错误会触发本地兜底报告，但不能假设所有 AI 错误都会自动兜底。排障时应先查看 Vercel Function 日志里的错误码和 OpenAI 请求状态。

### 5.3 报告保存与历史记录

入口：`GET/POST/PATCH /api/reports`

- `GET /api/reports`：返回当前老师最近 50 份报告
- `GET /api/reports?id=...`：读取单份报告
- `POST /api/reports`：新建报告并保存老师快照
- `PATCH /api/reports`：更新已有报告

API 和数据库 RLS 都限制老师只能访问自己的报告。报告保存 `teacher_snapshot`，因此老师日后更新个人简介不会改变已保存报告中的历史老师信息。

当前没有 `DELETE /api/reports` 和删除界面，尽管数据库已经有仅限本人删除的 RLS policy。

### 5.4 修改密码

老师可在工作台顶部打开修改密码窗口：

1. 输入当前密码
2. 输入新密码并确认
3. 系统重新验证当前密码
4. 调用 Supabase Auth 更新当前用户密码

新密码规则：至少 6 位，同时包含字母和数字。没有复杂符号、大小写或邮箱验证要求。

初始批量密码目前为 `123456`，它只适合首次登录。由于系统已经提供改密码功能，建议交接后要求老师首次登录自行修改。管理员重置密码会覆盖老师已经修改的密码，执行批量重置前必须确认影响范围。

## 6. 支持科目

当前科目目录共 31 个：

- SAT Math
- SAT English
- AP Calculus AB
- AP Calculus BC
- AP Computer Science A
- AP Microeconomics
- AP Macroeconomics
- AP Precalculus
- AP Physics 1
- AP Physics 2
- AP Physics C: Mechanics
- AP Physics C: Electricity and Magnetism
- AP Chemistry
- AP Biology
- AP Statistics
- AP Computer Science Principles
- AP United States History
- AP World History
- AP European History
- AP Psychology
- AP Human Geography
- AP Comparative Government and Politics
- AP English Literature and Composition
- AP English Language and Composition
- AP Art History
- AP Environmental Science
- AP United States Government and Politics
- AP Chinese Language and Culture
- AP Seminar
- AP Latin
- AP Music Theory

浏览器端目录的当前源文件是 `public/report/catalog.js`，服务端通过 `lib/subjects/catalog.js` 复用它。新增科目时至少需要同步检查：

- 显示名称和搜索关键词
- 科目家族与报告素材映射
- 输入字段和考试时间逻辑
- 英文专业术语
- 科目范围关键词与串科检测
- 教学阶段和课程规划规则
- 本地兜底内容
- 科目目录、搜索、范围和课程规划测试

AP 考试时间默认指向下一年 5 月，老师可以从下拉框选择更晚年份。SAT 科目仍由老师填写考试日期。

## 7. AI 提示词与质量控制

提示词不是单一字符串，而是由以下层次组合：

- 全局报告结构和语气
- 老师第一人称表达要求
- 家长可读性与证据边界
- 科目专属范围和英文术语
- 总课时与每节规划约束
- 质量检查失败后的修复要求

当前关键产品原则：

- 报告以授课老师本人视角表达，避免“老师认为”“需进一步向老师确认”等第三方话术
- 不把课堂未提供的成绩、正确率或薄弱点写成事实
- 缺少证据时使用可执行的后续诊断方案，而不是编造数据
- 专业术语保留英文并配合自然中文说明
- 每个学科使用自己的课程范围，避免 SAT 模板污染 AP 或 AP 学科之间串科
- 课程规划必须严格覆盖老师填写的预计总课时
- 内容尽量贴近真实授课，不输出泛化、重复、口号式计划

修改提示词时不要只做人工试生成。必须同时运行科目范围、总课时、质量检查和兜底报告测试，避免改善一个科目却破坏其他科目。

## 8. 报告和 PDF 结构

家长版报告当前顺序：

1. 科目封面
2. 学生信息与试听课总结
3. 课程规划，按内容高度动态分页
4. 登录老师介绍
5. SAT 或 AP 高分案例
6. 公司介绍
7. 课程介绍
8. SAT 或 AP 封底

内部销售跟进卡只在网页内部标签展示，不进入 PDF。

PDF 不是服务端生成文件，而是调用浏览器打印。建议使用 Chrome 或 Edge，目标选择“另存为 PDF”，关闭浏览器页眉页脚并启用背景图形。

文件名格式：

```text
学生姓名+科目+学情报告.pdf
```

示例：

```text
小王+AP Calculus BC+学情报告.pdf
```

文件名会清理不适合操作系统文件名的字符。数据库中虽然保留了 `pdf_path` 字段和 `report-pdfs` bucket，但当前代码没有把 PDF 上传到 Supabase。

品牌素材目录：`public/report/assets/`

主要素材：

- `lumist-sat-cover.png`
- `lumist-ap-cover.png`
- `lumist-sat-high-score-cases.jpg`
- `lumist-ap-high-score-cases.jpg`
- `lumist-company-introduction.jpeg`
- `lumist-course-introduction.jpg`
- `lumist-sat-back.png`
- `lumist-ap-back.png`
- `lumist-report-header-black.png`

替换素材时保持原有页面比例，并同时检查网页预览和打印预览。不要只用文件名覆盖后直接上线。

## 9. 老师资料模型

现有 Supabase 已创建 27 位老师账号，并同步了结构化介绍和职业照片。Amber 当前有二维码；其他老师大多没有二维码，页面会自动隐藏空缺区域。飞书老师数据源位于[老师信息多维表格](https://vm94j8bzy7.feishu.cn/wiki/HH5FwfbfRiIc30kh9CPcOkMmnyb?table=tblWhRxPsnyr7kVW&view=vewGZWuWr6)，实际访问权限由公司飞书管理员控制。

老师相关数据分三部分：

### 9.1 Supabase Auth

保存内部邮箱和密码，负责登录会话。

### 9.2 `profiles`

保存用户名、姓名和角色，与 Auth 用户 ID 一一对应。

### 9.3 `teacher_configs`

保存展示在报告老师介绍页的信息：

- `public_name`
- `title`
- `summary`
- `bio`
- `sections`
- `subjects`
- `photo_path`
- `qr_path`

照片和二维码应保存在私有 `teacher-assets` bucket，以用户 ID 为第一层目录。应用通过短期 signed URL 展示。

Amber 还保留了一套代码内默认资料和公开静态素材，作为配置缺失时的兼容兜底。其他老师如果没有二维码，页面会隐藏二维码区域，不显示破图。

## 10. 飞书老师同步

脚本：`scripts/sync-feishu-teachers.mjs`

命令：

```bash
npm run teachers:preview
npm run teachers:sync
npm run teachers:reset-passwords
```

执行顺序必须先 preview，核对新增、更新、跳过和错误数量后再 apply。

同步所需本地环境变量：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
FEISHU_TEACHER_BASE_TOKEN=
FEISHU_TEACHER_TABLE_ID=
FEISHU_TEACHER_VIEW_ID=
FEISHU_PROFILE=
LARK_CLI_PATH=
TEACHER_INITIAL_PASSWORD=123456
```

注意：Supabase 的 service role/secret key 不是 publishable key。它具有绕过 RLS 的管理权限，只允许存在于受控的本地管理环境或专用 CI Secret 中，绝不能放入浏览器代码、公开文档或提交到 Git。

飞书表当前需要这些字段：

- 导师姓名
- 海报用英文名
- 所授科目
- 导师小简介
- 导师职业照片
- 导师宣传二维码

当前实现可以创建/更新 Auth 用户、`profiles`、`teacher_configs` 和老师照片。二维码同步尚未实现，而且飞书里的二维码字段目前不适合直接作为 Storage 图片附件使用。后续建议把二维码改成附件字段，再扩展脚本上传文件并写入 `qr_path`。

脚本现在仍带有原开发机的 `lark-cli` 路径以及飞书数据源标识默认值。公司接手后的第一项代码清理应当是删除这些机器相关默认值，改为缺少环境变量就明确报错。公司电脑还需要自行安装并授权 `lark-cli`，不能依赖原开发机上的 `lumist-feishu` profile。

`.teacher-sync/` 可能包含账号和密码 CSV，已被 Git 忽略。它不属于代码交付物，不能上传仓库、飞书群或普通网盘。若公司需要接收现有账号清单，应通过公司的密码管理器单独移交，或由管理员统一重置。

## 11. 数据库、RLS 与 Storage

迁移文件必须按顺序执行：

```text
supabase/migrations/202607230001_initial_schema.sql
supabase/migrations/202607270001_multi_teacher_profiles.sql
```

主要表：

| 表 | 用途 |
| --- | --- |
| `profiles` | 用户名、姓名、角色 |
| `teacher_configs` | 老师介绍页结构化配置 |
| `reports` | 报告内容、表单快照和老师快照 |
| `company_configs` | 预留的公司配置 |

主要 Storage bucket：

| Bucket | 当前用途 |
| --- | --- |
| `teacher-assets` | 私有老师照片和未来二维码 |
| `report-pdfs` | 已创建但当前未被应用使用 |

安全规则：

- 报告只能由所属老师读、写、更新和删除
- 老师配置只能由本人访问
- 老师素材按当前用户 ID 文件夹隔离
- API 层仍会再次校验 `teacher_id = auth.uid()`

新 Supabase 部署有一个必须先处理的迁移风险：第二个 migration 尾部包含与现有 Amber 用户 UUID 绑定的数据补丁。全新 Supabase 中不存在该 Auth 用户时，直接运行可能触发外键问题。技术团队应先审查并移除或参数化这段实例数据，再执行迁移；不要把生产用户种子继续写死在通用 schema migration 中。

## 12. 环境变量

生产 Web 应用必需：

```dotenv
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-mini
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

本地可选：

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

仅老师同步管理脚本需要：

```dotenv
SUPABASE_SERVICE_ROLE_KEY=
FEISHU_TEACHER_BASE_TOKEN=
FEISHU_TEACHER_TABLE_ID=
FEISHU_TEACHER_VIEW_ID=
FEISHU_PROFILE=
LARK_CLI_PATH=
TEACHER_INITIAL_PASSWORD=123456
```

规则：

- `.env.local` 不提交 Git
- Vercel Production、Preview、Development 环境分别核对变量
- 变量新增或修改后重新部署
- publishable key 可以进入客户端，service role/secret key 不可以
- 不建议把 `SUPABASE_SERVICE_ROLE_KEY` 放到 Vercel，当前线上运行不需要它
- 交接后轮换 OpenAI Key、Supabase 管理 Key 和飞书授权

## 13. 本地启动与验证

```bash
git clone https://github.com/monomomo/lumist-trial-report.git
cd lumist-trial-report
npm ci
cp .env.example .env.local
npm run dev
```

打开：

```text
http://localhost:3000
```

测试与构建：

```bash
node --test test/*.test.mjs
npm run build
```

当前测试覆盖：

- 课程规划编辑与质量检查
- 课时槽位和总课时
- 本地兜底报告
- PDF 文件名
- 报告状态与历史记录
- 科目目录、搜索和串科检查
- 老师资料展示
- 用户名登录映射

目前没有完整浏览器 E2E 和打印像素回归测试，所以每次上线仍需人工验证登录、生成、保存、历史打开和 PDF 打印。

## 14. 重新部署方案

### 14.1 方案 A：新 Vercel + 复用现有 Supabase

适合目标：尽快把代码和部署权限转移给公司，同时保留全部现有数据。

步骤：

1. 把 GitHub 仓库转入公司组织或授予公司团队权限
2. 在公司 Vercel 组织导入仓库
3. 配置 OpenAI 和现有 Supabase 环境变量
4. 部署 Preview 环境
5. 使用 Amber 和至少两位其他老师账号做验收
6. 验证历史报告仍可见
7. 验证修改密码后可重新登录
8. 完成生产域名切换
9. 切换稳定后撤销原个人部署权限并轮换密钥

优点：账号、密码、老师资料、照片和历史报告全部保留。  
风险：数据库暂时仍在原 Supabase 项目，需要同步转移 Supabase 项目所有权和账单权限。

### 14.2 方案 B：新 Vercel + 全新 Supabase

适合目标：公司从第一天完全拥有所有基础设施。

步骤：

1. 创建新的 Supabase 项目
2. 审查并修正 Amber UUID 的 migration 实例数据
3. 按顺序运行两个 migration
4. 配置 Auth、URL、publishable key 和 service role/secret key
5. 在公司电脑配置飞书 CLI 与同步环境变量
6. preview 后执行老师同步
7. 迁移老师照片和未来二维码
8. 单独迁移历史 `reports`
9. 制定 Auth 用户和密码迁移方案
10. 验证每位老师的用户 ID 与 `profiles`、`teacher_configs`、Storage 目录一致
11. 部署 Preview 并完成全量验收
12. 最后切换生产域名

重要事实：飞书同步只能重建老师账号、简介和照片，不能迁移历史报告，也不能恢复老师自己修改后的密码。Supabase Auth 密码迁移不能靠读取明文完成。如果不做 Auth 迁移，就必须向老师发放新初始密码并要求重新修改。

### 14.3 推荐切换策略

推荐采用两阶段切换：

1. 先执行方案 A，无损把代码、Vercel 和运维权限交给公司
2. 对现有 Supabase 做备份和迁移演练
3. 在 Preview 环境完成新 Supabase 全量验收
4. 安排维护窗口后切换数据库

这样可以把“应用重新部署”和“用户数据迁移”拆开，发生问题时更容易回滚。

## 15. Vercel 部署注意事项

- Framework Preset 使用 Next.js
- Install Command 使用 `npm ci`
- Build Command 使用 `npm run build`
- 不需要额外 Output Directory
- `generate-report` 路由声明最大执行 300 秒，需确认公司 Vercel 套餐允许该时长
- OpenAI 请求可能持续数分钟，不能把代理层超时设置得低于应用超时
- 切换域名前先在 Preview 完成真实 AI 生成，不要只验证首页能打开
- 检查 Vercel Function 日志中是否存在 401、429、503、超时和 Structured Output 解析错误

## 16. 上线验收清单

### 16.1 登录与账号

- [ ] 未登录时只能看到登录页
- [ ] Amber 可以登录
- [ ] 至少两位非 Amber 老师可以登录
- [ ] 错误密码有明确提示
- [ ] 退出后无法继续访问工作台
- [ ] 修改密码后旧密码失效、新密码可登录

### 16.2 老师资料

- [ ] 登录老师的姓名、职称、简介和科目正确
- [ ] Amber 照片和二维码正确
- [ ] 其他老师照片正确
- [ ] 没有二维码的老师不会显示空白或破图
- [ ] A 老师不能读取 B 老师资料或报告

### 16.3 生成报告

- [ ] SAT Math 可以成功生成
- [ ] SAT English 可以成功生成
- [ ] AP Calculus BC 可以成功生成
- [ ] 再选一个非数学 AP 科目成功生成
- [ ] AP 考试时间默认下一年 5 月且可选择后续年份
- [ ] 50 小时报告总课时严格等于 50 小时
- [ ] 报告没有其他学科污染
- [ ] 家长版内容使用老师本人语气
- [ ] 证据不足时不会编造分数或正确率

### 16.4 保存与历史

- [ ] 新报告可保存
- [ ] 历史列表可看到保存结果
- [ ] 历史报告可重新打开
- [ ] 编辑后可以更新同一份报告
- [ ] 重新登录后历史数据仍存在
- [ ] 另一位老师看不到该报告

### 16.5 页面和 PDF

- [ ] 长试听总结不会超出页面
- [ ] 长课程规划可以合理分页，不是一节课一页
- [ ] 每页页眉 Logo 大小和位置一致
- [ ] 顺序为高分案例、公司介绍、课程介绍、封底
- [ ] SAT 与 AP 展示各自的封面、高分案例和封底
- [ ] PDF 不包含内部销售跟进卡
- [ ] PDF 文件名符合“学生姓名+科目+学情报告.pdf”
- [ ] 打印预览无截断、空白页和内容溢出

## 17. 常见运维操作

### 新增或更新老师

1. 在飞书多维表格完善老师姓名、英文名、科目、简介和职业照片
2. 本地运行 `npm run teachers:preview`
3. 核对变更
4. 运行 `npm run teachers:sync`
5. 使用新老师账号登录验收
6. 单独安全发送初始密码

### 管理员重置密码

单个老师优先使用 Supabase Dashboard 的 Auth 用户管理功能。批量重置才运行：

```bash
npm run teachers:reset-passwords
```

该命令会影响全部匹配老师，不能当作普通同步命令使用。

### 老师忘记密码

当前没有邮件找回。管理员在 Supabase Dashboard 重置该 Auth 用户密码，再通过安全渠道发送临时密码。

### OpenAI 生成失败

1. 查看浏览器 Network 中 `/api/generate-report` 的状态码和错误码
2. 查看 Vercel Function 日志
3. 检查 `OPENAI_API_KEY`、模型名、额度和限流
4. 区分输入校验、串科校验、质量失败和上游超时
5. 使用同一输入在 Preview 复现
6. 不要通过删除全部质量规则来临时恢复服务

### `/api/me` 返回 503

优先检查 Supabase 环境变量是否存在且匹配同一个项目。缺少或错配 URL/publishable key 会导致登录和老师资料请求失败。

## 18. 已知限制与技术债

按优先级排列：

### P0：交接和部署前

- 把飞书同步脚本里的原开发机路径和数据源默认值改为强制环境变量
- 审查新 Supabase migration 中写死的 Amber UUID 实例数据
- 决定复用还是迁移现有 Supabase，并形成书面回滚方案
- 把 GitHub、Vercel、Supabase、OpenAI 和飞书权限转到公司主体并轮换密钥
- 对现有数据库和 Storage 做可恢复备份

### P1：稳定性

- 增加 Playwright 登录、生成、保存、历史和密码修改 E2E
- 增加 PDF 打印视觉回归或固定浏览器版本的自动截图检查
- 给 AI 请求加入可观测性，至少记录 request ID、科目、耗时、错误码和模型，不记录完整敏感课堂内容
- 为历史报告增加分页、搜索和归档
- 设计单老师密码重置脚本，避免批量重置误操作

### P2：产品完善

- 实现飞书二维码附件自动同步
- 增加管理员管理页面
- 根据需要实现报告删除/归档
- 根据合规要求实现服务端 PDF 归档
- 把品牌素材升级为有版本的配置或 CMS 管理

## 19. 数据安全与合规提醒

报告可能包含学生姓名、成绩、目标学校、考试计划和课堂表现，属于需要谨慎处理的教育数据。

- 不要在日志中记录完整老师输入和完整 AI 报告
- 不要把真实学生数据放入公开 Issue、截图或测试 fixture
- 定期清理无业务价值的历史报告
- 明确公司内部的数据保留周期和访问权限
- GitHub、Vercel、Supabase、OpenAI 和飞书全部使用公司账号与最小权限
- service role/secret key、OpenAI Key 和账号密码不能进入 Git
- `.teacher-sync/` 和 `.env.local` 不属于代码交付物
- 离职或角色变更时及时停用 Auth 用户并撤销后台权限

## 20. 交付物清单

代码仓库内：

- 应用源码
- 两个 Supabase migration
- 飞书老师同步脚本
- 自动化单元测试
- 本技术交接文档
- `docs/老师使用指南.md`
- `.env.example`

需要通过公司安全渠道另行交接：

- GitHub 仓库所有权或管理员权限
- Vercel 项目和域名权限
- Supabase 项目所有权、账单和备份
- OpenAI Project 和 API Key 管理权限
- 飞书多维表格权限及公司 `lark-cli` 授权
- 当前老师账号清单或统一重置方案

禁止作为普通附件交接：

- `.env.local`
- service role/secret key 明文
- OpenAI API Key 明文
- `.teacher-sync/` 密码 CSV
- 真实学生报告数据库导出

## 21. 技术团队接手后的首周建议

1. 在公司账号下 fork/迁移仓库并开启分支保护
2. 创建 Preview 部署，先复用现有 Supabase 做全链路验收
3. 轮换密钥并撤销个人账号权限
4. 清理飞书脚本的机器相关默认值和 Amber migration 实例数据
5. 建立数据库、Storage 和环境变量备份清单
6. 增加最小 E2E 测试和错误监控
7. 再决定是否进行新 Supabase 的完整数据迁移

## 22. 发布前固定检查

每次合并到 `main` 前至少执行：

```bash
git status --short
node --test test/*.test.mjs
npm run build
```

发布后至少抽查：登录、生成一份 SAT、生成一份 AP、保存历史、重新打开、修改密码和 PDF 打印。任何涉及提示词、课程分页、老师资料或素材的改动，都要额外检查多个科目，不能只用 Amber 的 SAT 报告作为唯一验收样本。
