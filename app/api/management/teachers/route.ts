import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthResult, AUTH_STATUS } from '@/lib/auth/current-user';
import { authEmailToUsername, usernameToAuthEmail, isValidUsername } from '@/lib/auth/username';
import { getTeacherPasswordError } from '@/lib/auth/password';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const profileFields = z.object({
  displayName: z.string().trim().min(1).max(40),
  publicName: z.string().trim().min(1).max(60),
  title: z.string().trim().max(120).default(''),
  summary: z.string().trim().max(500).default(''),
  bio: z.array(z.string().trim().min(1).max(600)).max(20).default([]),
  subjects: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
});

const createSchema = profileFields.extend({
  username: z.string().trim().min(3).max(32),
  password: z.string().min(6).max(100),
});

const updateSchema = profileFields.extend({
  teacherId: z.string().uuid(),
  active: z.boolean(),
});

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

async function getManagementContext() {
  const auth = await getAuthResult();
  if (auth.status === AUTH_STATUS.SUPABASE_NOT_CONFIGURED) return { response: errorResponse('SYSTEM_NOT_CONFIGURED', 503) };
  if (auth.status === AUTH_STATUS.NOT_AUTHENTICATED) return { response: errorResponse('UNAUTHORIZED', 401) };
  if (auth.user?.role !== 'management') return { response: errorResponse('FORBIDDEN', 403) };
  const admin = createAdminClient();
  if (!admin) return { response: errorResponse('MANAGEMENT_SERVICE_NOT_CONFIGURED', 503) };
  return { admin };
}

export async function GET() {
  const context = await getManagementContext();
  if ('response' in context) return context.response;
  const { data: users, error: userError } = await context.admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (userError) return errorResponse('TEACHER_LIST_FAILED', 500);
  const userIds = users.users.filter((user) => user.email?.endsWith('@teachers.lumist.internal')).map((user) => user.id);
  const { data: profiles, error: profileError } = await context.admin.from('profiles').select('id,display_name,role,created_at,updated_at').in('id', userIds);
  if (profileError) return errorResponse('TEACHER_LIST_FAILED', 500);
  const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
  const teacherUsers = users.users.filter((user) => user.email?.endsWith('@teachers.lumist.internal') && profileMap.get(user.id)?.role === 'teacher');
  const teacherIds = teacherUsers.map((user) => user.id);
  const { data: configs, error: configError } = await context.admin.from('teacher_configs').select('teacher_id,public_name,title,summary,bio,sections,subjects,photo_path,qr_path,updated_at').in('teacher_id', teacherIds);
  if (configError) return errorResponse('TEACHER_LIST_FAILED', 500);
  const configMap = new Map((configs || []).map((config) => [config.teacher_id, config]));
  const teachers = teacherUsers.map((user) => {
    const profile = profileMap.get(user.id);
    const config = configMap.get(user.id);
    return {
      id: user.id,
      username: authEmailToUsername(user.email || ''),
      displayName: profile?.display_name || user.user_metadata?.display_name || authEmailToUsername(user.email || ''),
      active: !user.banned_until || new Date(user.banned_until).getTime() <= Date.now(),
      createdAt: user.created_at,
      publicName: config?.public_name || profile?.display_name || authEmailToUsername(user.email || ''),
      title: config?.title || '',
      summary: config?.summary || '',
      bio: Array.isArray(config?.bio) ? config.bio.map(String) : [],
      subjects: Array.isArray(config?.subjects) ? config.subjects.map(String) : [],
      photoPath: config?.photo_path || '',
      qrPath: config?.qr_path || '',
    };
  });
  return NextResponse.json({ teachers });
}

export async function POST(request: Request) {
  const context = await getManagementContext();
  if ('response' in context) return context.response;
  const parsed = createSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse('老师账号和资料填写不完整。', 400);
  if (!isValidUsername(parsed.data.username)) return errorResponse('老师账号格式不正确。', 400);
  const passwordError = getTeacherPasswordError(parsed.data.password);
  if (passwordError) return errorResponse(passwordError, 400);
  const { data, error } = await context.admin.auth.admin.createUser({
    email: usernameToAuthEmail(parsed.data.username),
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { display_name: parsed.data.displayName },
  });
  if (error || !data.user) return errorResponse('老师账号创建失败，请确认账号尚未被使用。', 409);
  const { error: profileError } = await context.admin.from('profiles').update({ display_name: parsed.data.displayName, role: 'teacher' }).eq('id', data.user.id);
  const { error: configError } = await context.admin.from('teacher_configs').upsert({
    teacher_id: data.user.id,
    public_name: parsed.data.publicName,
    title: parsed.data.title,
    summary: parsed.data.summary,
    bio: parsed.data.bio,
    sections: [],
    subjects: parsed.data.subjects,
  });
  if (profileError || configError) {
    await context.admin.auth.admin.deleteUser(data.user.id);
    return errorResponse('老师资料保存失败，账号未完成创建。', 500);
  }
  return NextResponse.json({ created: true, teacherId: data.user.id });
}

export async function PATCH(request: Request) {
  const context = await getManagementContext();
  if ('response' in context) return context.response;
  const parsed = updateSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse('老师资料填写不完整。', 400);
  const { teacherId, active, ...profile } = parsed.data;
  const { error: authError } = await context.admin.auth.admin.updateUserById(teacherId, { ban_duration: active ? 'none' : '876000h' });
  if (authError) return errorResponse('老师账号状态更新失败。', 500);
  const { error: profileError } = await context.admin.from('profiles').update({ display_name: profile.displayName }).eq('id', teacherId);
  const { error: configError } = await context.admin.from('teacher_configs').upsert({
    teacher_id: teacherId,
    public_name: profile.publicName,
    title: profile.title,
    summary: profile.summary,
    bio: profile.bio,
    subjects: profile.subjects,
  });
  if (profileError || configError) return errorResponse('老师资料更新失败。', 500);
  return NextResponse.json({ updated: true });
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
