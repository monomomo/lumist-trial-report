import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthResult, AUTH_STATUS } from '@/lib/auth/current-user';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  teacherId: z.string().uuid(),
  kind: z.enum(['photo', 'qr']),
});

const allowedTypes = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
  const auth = await getAuthResult();
  if (auth.status === AUTH_STATUS.SUPABASE_NOT_CONFIGURED) return errorResponse('SYSTEM_NOT_CONFIGURED', 503);
  if (auth.status === AUTH_STATUS.NOT_AUTHENTICATED) return errorResponse('UNAUTHORIZED', 401);
  if (auth.user?.role !== 'management') return errorResponse('FORBIDDEN', 403);
  const admin = createAdminClient();
  if (!admin) return errorResponse('MANAGEMENT_SERVICE_NOT_CONFIGURED', 503);

  const formData = await request.formData();
  const parsed = requestSchema.safeParse({ teacherId: formData.get('teacherId'), kind: formData.get('kind') });
  const file = formData.get('file');
  if (!parsed.success || !(file instanceof File)) return errorResponse('上传信息不完整。', 400);
  const extension = allowedTypes.get(file.type);
  if (!extension) return errorResponse('只支持 JPG、PNG 或 WebP 图片。', 400);
  const maxSize = parsed.data.kind === 'photo' ? 5 * 1024 * 1024 : 3 * 1024 * 1024;
  if (file.size === 0 || file.size > maxSize) return errorResponse(parsed.data.kind === 'photo' ? '职业照不能超过 5MB。' : '二维码图片不能超过 3MB。', 400);

  const { data: profile } = await admin.from('profiles').select('id,role').eq('id', parsed.data.teacherId).maybeSingle();
  if (!profile || profile.role !== 'teacher') return errorResponse('未找到该老师账号。', 404);

  const filename = parsed.data.kind === 'photo' ? `management-profile.${extension}` : `management-video-qr.${extension}`;
  const path = `${parsed.data.teacherId}/${filename}`;
  const { error: uploadError } = await admin.storage.from('teacher-assets').upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true });
  if (uploadError) return errorResponse('图片上传失败，请稍后重试。', 500);

  const column = parsed.data.kind === 'photo' ? 'photo_path' : 'qr_path';
  const { error: updateError } = await admin.from('teacher_configs').update({ [column]: path }).eq('teacher_id', parsed.data.teacherId);
  if (updateError) return errorResponse('图片已上传，但老师资料更新失败。', 500);

  const { data: signed } = await admin.storage.from('teacher-assets').createSignedUrl(path, 3600);
  return NextResponse.json({ path, url: signed?.signedUrl || '' });
}
