import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getTeacherPasswordError } from '@/lib/auth/password';
import { getRegistrationCode, getRegistrationRole, matchesRegistrationCode } from '@/lib/auth/registration';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidUsername, usernameToAuthEmail } from '@/lib/auth/username';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  role: z.string().trim(),
  displayName: z.string().trim().min(1).max(40),
  username: z.string().trim().min(3).max(32),
  password: z.string().min(6).max(100),
  inviteCode: z.string().trim().min(1).max(200),
});

function responseError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return responseError('注册信息无法读取。', 400);
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return responseError('请完整填写注册信息。', 400);
  const role = getRegistrationRole(parsed.data.role);
  if (!role) return responseError('注册角色无效。', 400);
  if (!isValidUsername(parsed.data.username)) return responseError('账号格式不正确，请使用 3–32 位字母、数字、点、下划线或短横线。', 400);
  const passwordError = getTeacherPasswordError(parsed.data.password);
  if (passwordError) return responseError(passwordError, 400);
  const expectedCode = getRegistrationCode(role);
  if (!matchesRegistrationCode(parsed.data.inviteCode, expectedCode)) return responseError('邀请码不正确或注册暂未开放。', 403);
  const admin = createAdminClient();
  if (!admin) return responseError('注册服务尚未配置，请联系管理员。', 503);
  const email = usernameToAuthEmail(parsed.data.username);
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { display_name: parsed.data.displayName },
  });
  if (error || !data.user) return responseError('账号创建失败，请确认账号尚未被使用。', 409);
  const profileRole = role === 'management' ? 'admin' : 'sales';
  const { error: profileError } = await admin.from('profiles').update({ display_name: parsed.data.displayName, role: profileRole }).eq('id', data.user.id);
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return responseError('账号资料保存失败，请稍后重试。', 500);
  }
  return NextResponse.json({ registered: true, username: parsed.data.username });
}
