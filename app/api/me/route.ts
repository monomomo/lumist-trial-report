import { NextResponse } from 'next/server';
import { getAuthResult, AUTH_STATUS } from '@/lib/auth/current-user';
import { getTeacherPublicProfile } from '@/lib/teachers/public-profile';

/** 当前教师公开资料。同一域名下的 iframe 可通过 fetch 调用，自动携带 session cookie。 */
export async function GET() {
  const auth = await getAuthResult();

  if (auth.status === AUTH_STATUS.SUPABASE_NOT_CONFIGURED) {
    return NextResponse.json({ error: 'SYSTEM_NOT_CONFIGURED' }, { status: 503 });
  }

  if (auth.status === AUTH_STATUS.NOT_AUTHENTICATED) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const profile = await getTeacherPublicProfile(auth.user!.id, auth.user!.email);
  if (!profile) {
    return NextResponse.json({ error: 'PROFILE_NOT_FOUND' }, { status: 404 });
  }

  return NextResponse.json(profile);
}
