import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join, relative } from 'node:path';
import { compactCompleteText } from './teacher-profile-text.mjs';

const BASE_TOKEN = process.env.FEISHU_TEACHER_BASE_TOKEN || 'LmYfb8Mw4a8T6wsOtexc6RfEnNh';
const TABLE_ID = process.env.FEISHU_TEACHER_TABLE_ID || 'tblWhRxPsnyr7kVW';
const VIEW_ID = process.env.FEISHU_TEACHER_VIEW_ID || 'vewGZWuWr6';
const PROFILE = process.env.FEISHU_PROFILE || 'lumist-feishu';
const LARK_CLI = process.env.LARK_CLI_PATH || '/Users/ljyyass1231gmail.com/.local/bin/lark-cli';
const AUTH_DOMAIN = 'teachers.lumist.internal';
const APPLY = process.argv.includes('--apply');
const ALLOW_WARNINGS = process.argv.includes('--allow-warnings');
const SKIP_PHOTOS = process.argv.includes('--skip-photos');
const RESET_PASSWORDS = process.argv.includes('--reset-passwords');
const INITIAL_PASSWORD = process.env.TEACHER_INITIAL_PASSWORD || '123456';

const fieldNames = ['导师姓名', '海报用英文名', '所授科目', '导师小简介', '导师职业照片', '导师宣传二维码'];
const sectionNames = ['教育背景', '教学经历', '过往成就', '擅长科目'];

function runLark(args) {
  const output = execFileSync(LARK_CLI, args, {
    encoding: 'utf8',
    env: { ...process.env, LARK_CLI_NO_PROXY: '1' },
    maxBuffer: 20 * 1024 * 1024,
  });
  return JSON.parse(output);
}

function readTeachers() {
  const args = [
    'base', '+record-list', '--profile', PROFILE, '--base-token', BASE_TOKEN,
    '--table-id', TABLE_ID, '--view-id', VIEW_ID, '--limit', '200', '--format', 'json',
  ];
  for (const fieldName of fieldNames) args.push('--field-id', fieldName);
  const response = runLark(args);
  if (!response.ok) throw new Error('飞书教师表读取失败');
  const fields = response.data.fields;
  return response.data.data.flatMap((row, index) => {
    const values = Object.fromEntries(fields.map((field, fieldIndex) => [field, row[fieldIndex]]));
    const name = cleanText(values['导师姓名']);
    if (!name) return [];
    return [{
      recordId: response.data.record_id_list[index],
      name,
      englishName: cleanText(values['海报用英文名']),
      subjectText: cleanText(values['所授科目']),
      intro: cleanText(values['导师小简介']),
      photos: Array.isArray(values['导师职业照片']) ? values['导师职业照片'] : [],
      qrText: cleanText(values['导师宣传二维码']),
    }];
  });
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function splitSubjects(value) {
  return [...new Set(value.split(/[,，、/]/).map((item) => item.trim()).filter(Boolean))];
}

function parseSections(intro, englishName) {
  const initial = Object.fromEntries(sectionNames.map((name) => [name, []]));
  let current = '';
  for (const rawLine of intro.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.replace(/[：:]/g, '').trim().toLowerCase() === englishName.toLowerCase()) continue;
    if (/^语言能力[：:]/.test(line)) {
      current = '';
      continue;
    }
    const match = line.match(/^(教育背景|教学经历|过往成就|擅长科目)[：:]\s*(.*)$/);
    if (match) {
      current = match[1];
      if (match[2]) initial[current].push(match[2]);
      continue;
    }
    if (current) initial[current].push(line);
  }
  return sectionNames.flatMap((title) => {
    const content = initial[title];
    if (content.length === 0) return [];
    const limit = title === '教学经历' || title === '过往成就' ? 210 : 160;
    return [{ title, content: [compactCompleteText(content.join('；'), limit)] }];
  }).slice(0, 4);
}

function buildUsername(teacher) {
  if (teacher.englishName.toLowerCase().startsWith('amber ')) return 'amberlyu';
  return teacher.englishName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 32);
}

function buildProfile(teacher) {
  const subjects = splitSubjects(teacher.subjectText);
  const specificSubjects = subjects.filter((subject) => !['国际课程', 'AP', 'ALEVEL', 'IB', '竞赛/语培/入学考试'].includes(subject));
  const sections = parseSections(teacher.intro, teacher.englishName);
  const teaching = sections.find((section) => section.title === '教学经历')?.content[0] || '';
  const titleSubjects = specificSubjects.slice(0, 2).join('、');
  return {
    username: buildUsername(teacher),
    publicName: teacher.englishName,
    title: titleSubjects ? `${titleSubjects}导师` : '国际课程导师',
    summary: compactCompleteText(teaching || `${teacher.englishName} 老师专注于国际课程教学与个性化辅导。`, 115),
    bio: sections.map((section) => section.content[0]),
    sections,
    subjects,
  };
}

function validate(teacher, profile) {
  const errors = [];
  const warnings = [];
  if (!teacher.englishName) errors.push('缺少英文名');
  if (!teacher.subjectText) errors.push('缺少授课科目');
  if (!teacher.intro) errors.push('缺少导师简介');
  if (teacher.photos.length === 0) errors.push('缺少职业照');
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(profile.username)) errors.push('无法生成有效账号名');
  const suspiciousYears = [...teacher.intro.matchAll(/(\d{2,})\s*年(?:以上|经验)/g)].map((match) => Number(match[1]));
  if (suspiciousYears.some((years) => years > 30)) warnings.push('简介中的教学年限可能有误');
  if (teacher.intro.length > 900) warnings.push('简介过长，报告页将展示压缩后的版本');
  return { errors, warnings };
}

function contentType(filename) {
  const extension = extname(filename).toLowerCase();
  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';
  return 'image/jpeg';
}

function downloadPhoto(teacher, directory) {
  const attachment = teacher.photos[0];
  const extension = extname(attachment.name) || '.jpg';
  const output = join(directory, `${teacher.recordId}${extension}`);
  const relativeOutput = relative(process.cwd(), output);
  runLark([
    'base', '+record-download-attachment', '--profile', PROFILE, '--base-token', BASE_TOKEN,
    '--table-id', TABLE_ID, '--record-id', teacher.recordId, '--file-token', attachment.file_token,
    '--output', relativeOutput, '--overwrite', '--format', 'json',
  ]);
  return output;
}

async function listUsers(supabase) {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function saveCredentials(outputPath, credentials) {
  const rows = [['账号', '初始密码', '姓名', '报告展示名'], ...credentials].map((row) => row.map(csvCell).join(','));
  writeFileSync(outputPath, `${rows.join('\n')}\n`, { mode: 0o600 });
  chmodSync(outputPath, 0o600);
}

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error('缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY');
  if (INITIAL_PASSWORD.length < 6) throw new Error('TEACHER_INITIAL_PASSWORD 不能少于 6 位');
  return createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function resetTeacherPasswords(teachers) {
  const supabase = createAdminClient();
  const users = await listUsers(supabase);
  const usersByEmail = new Map(users.map((user) => [user.email?.toLowerCase(), user]));
  const credentialsDirectory = join(process.cwd(), '.teacher-sync');
  mkdirSync(credentialsDirectory, { recursive: true });
  const credentialsPath = join(credentialsDirectory, `all-accounts-${new Date().toISOString().replaceAll(':', '-')}.csv`);
  const credentials = [];
  for (const teacher of teachers) {
    const profile = buildProfile(teacher);
    const email = `${profile.username}@${AUTH_DOMAIN}`;
    const user = usersByEmail.get(email);
    if (!user) throw new Error(`${teacher.name} 的账号不存在，不能统一重置密码`);
    const { error } = await supabase.auth.admin.updateUserById(user.id, { password: INITIAL_PASSWORD });
    if (error) throw new Error(`${teacher.name} 重置密码失败：${error.message}`);
    credentials.push([profile.username, INITIAL_PASSWORD, teacher.name, profile.publicName]);
    saveCredentials(credentialsPath, credentials);
    process.stdout.write(`已重置 ${teacher.name} / ${profile.username}\n`);
  }
  process.stdout.write(`全部账号凭据已写入 ${credentialsPath}\n`);
}

async function applyTeachers(teachers) {
  const supabase = createAdminClient();
  const users = await listUsers(supabase);
  const usersByEmail = new Map(users.map((user) => [user.email?.toLowerCase(), user]));
  const credentialsDirectory = join(process.cwd(), '.teacher-sync');
  mkdirSync(credentialsDirectory, { recursive: true });
  const tempDirectory = mkdtempSync(join(credentialsDirectory, 'downloads-'));
  const credentialsPath = join(credentialsDirectory, `new-accounts-${new Date().toISOString().replaceAll(':', '-')}.csv`);
  const credentials = [];
  for (const teacher of teachers) {
    const profile = buildProfile(teacher);
    const email = `${profile.username}@${AUTH_DOMAIN}`;
    let localPhoto = null;
    if (!SKIP_PHOTOS) localPhoto = downloadPhoto(teacher, tempDirectory);
    let user = usersByEmail.get(email);
    if (!user) {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: INITIAL_PASSWORD,
        email_confirm: true,
        user_metadata: { display_name: profile.publicName, username: profile.username },
      });
      if (error) throw new Error(`${teacher.name} 创建账号失败：${error.message}`);
      user = data.user;
      credentials.push([profile.username, INITIAL_PASSWORD, teacher.name, profile.publicName]);
      saveCredentials(credentialsPath, credentials);
    } else {
      const { data: existingConfig, error: existingConfigError } = await supabase
        .from('teacher_configs')
        .select('teacher_id')
        .eq('teacher_id', user.id)
        .maybeSingle();
      if (existingConfigError) throw new Error(`${teacher.name} 检查 teacher_configs 失败：${existingConfigError.message}`);
      if (!existingConfig && profile.username !== 'amberlyu') {
        const { error } = await supabase.auth.admin.updateUserById(user.id, { password: INITIAL_PASSWORD });
        if (error) throw new Error(`${teacher.name} 修复初始密码失败：${error.message}`);
        credentials.push([profile.username, INITIAL_PASSWORD, teacher.name, profile.publicName]);
        saveCredentials(credentialsPath, credentials);
      }
    }
    const { error: profileError } = await supabase.from('profiles').upsert({ id: user.id, display_name: profile.publicName, role: 'teacher' });
    if (profileError) throw new Error(`${teacher.name} 更新 profiles 失败：${profileError.message}`);
    let photoPath = null;
    if (localPhoto) {
      photoPath = `${user.id}/profile${extname(localPhoto).toLowerCase() || '.jpg'}`;
      const { error: uploadError } = await supabase.storage.from('teacher-assets').upload(photoPath, readFileSync(localPhoto), {
        contentType: contentType(basename(localPhoto)),
        upsert: true,
      });
      if (uploadError) throw new Error(`${teacher.name} 上传职业照失败：${uploadError.message}`);
    }
    const config = {
      teacher_id: user.id,
      public_name: profile.publicName,
      title: profile.title,
      summary: profile.summary,
      bio: profile.bio,
      sections: profile.sections,
      subjects: profile.subjects,
    };
    if (photoPath) config.photo_path = photoPath;
    const { error: configError } = await supabase.from('teacher_configs').upsert(config);
    if (configError) throw new Error(`${teacher.name} 更新 teacher_configs 失败：${configError.message}`);
    process.stdout.write(`已同步 ${teacher.name} / ${profile.username}\n`);
  }
  if (credentials.length > 0) {
    process.stdout.write(`新账号凭据已写入 ${credentialsPath}\n`);
  } else {
    process.stdout.write('没有创建新账号，现有账号资料已更新\n');
  }
}

const teachers = readTeachers();
const profiles = teachers.map((teacher) => ({ teacher, profile: buildProfile(teacher) }));
const usernames = new Set();
for (const item of profiles) {
  const validation = validate(item.teacher, item.profile);
  item.errors = validation.errors;
  item.warnings = validation.warnings;
  if (usernames.has(item.profile.username)) item.errors.push('账号名重复');
  usernames.add(item.profile.username);
}

process.stdout.write(`${JSON.stringify(profiles.map(({ teacher, profile, errors, warnings }) => ({
  name: teacher.name,
  displayName: profile.publicName,
  username: profile.username,
  subjects: profile.subjects.length,
  errors,
  warnings,
})), null, 2)}\n`);

const errors = profiles.flatMap((item) => item.errors.map((message) => `${item.teacher.name}：${message}`));
const warnings = profiles.flatMap((item) => item.warnings.map((message) => `${item.teacher.name}：${message}`));
process.stdout.write(`共 ${profiles.length} 位教师，${errors.length} 个错误，${warnings.length} 个警告\n`);

if (errors.length > 0) throw new Error(`教师资料校验失败：${errors.join('；')}`);
if (APPLY && warnings.length > 0 && !ALLOW_WARNINGS) {
  throw new Error(`存在资料警告，请先修复飞书数据或明确追加 --allow-warnings：${warnings.join('；')}`);
}
if (APPLY && RESET_PASSWORDS) await resetTeacherPasswords(profiles.map((item) => item.teacher));
else if (APPLY) await applyTeachers(profiles.map((item) => item.teacher));
else process.stdout.write('当前为预览模式，未修改 Supabase\n');
