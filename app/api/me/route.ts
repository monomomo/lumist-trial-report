import { NextResponse } from 'next/server';
import { getAuthResult, AUTH_STATUS } from '@/lib/auth/current-user';

export async function GET() {
  const auth = await getAuthResult();

  if (auth.status === AUTH_STATUS.SUPABASE_NOT_CONFIGURED) {
    return NextResponse.json({ error: 'SYSTEM_NOT_CONFIGURED' }, { status: 503 });
  }

  if (auth.status === AUTH_STATUS.NOT_AUTHENTICATED) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { getTeacherPublicProfile } = await import('@/lib/teachers/public-profile');
  const profile = await getTeacherPublicProfile(auth.user!.id, auth.user!.email);
  if (!profile) {
    return NextResponse.json({ error: 'PROFILE_NOT_FOUND' }, { status: 404 });
  }

  return NextResponse.json(profile);
}
