import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

export interface TeacherPublicProfile {
  displayName: string;
  displayPlaceholder: string;
  title: string | null;
  bio: string[];
  photoUrl: string | null;
  qrUrl: string | null;
  subjects: string[];
}

/** 教师资料未配置时的默认 bio。 */
export const DEFAULT_BIO: string[] = [
  '拥有丰富的教学经验，擅长以清晰的知识框架与真实题目训练帮助学生提升考试表现。',
  '坚持围绕学生薄弱点制定个性化计划，并兼顾考试表现与长期学科发展。',
];

/**
 * 获取当前教师的公开资料。
 *
 * displayName 降级链：teacher_configs.public_name → profiles.display_name → email 本地部分。
 * photoPath / qrPath 通过 Supabase Storage 签名 URL 返回，有效期 1 小时。
 * bio 支持数组或 { paragraphs: string[] } 两种 jsonb 结构。
 */
export async function getTeacherPublicProfile(
  userId: string,
  email: string,
): Promise<TeacherPublicProfile | null> {
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();

  const [profileResult, configResult] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', userId).single(),
    supabase.from('teacher_configs').select('*').eq('teacher_id', userId).maybeSingle(),
  ]);

  const profile = profileResult.data;
  const config = configResult.data;

  const emailLocalPart = email.includes('@') ? email.split('@')[0] : '老师';
  const displayName = config?.public_name || profile?.display_name || emailLocalPart;

  let photoUrl: string | null = null;
  let qrUrl: string | null = null;

  if (config?.photo_path) {
    const { data: photoData } = await supabase.storage
      .from('teacher-assets')
      .createSignedUrl(config.photo_path, 3600);
    photoUrl = photoData?.signedUrl ?? null;
  }
  if (config?.qr_path) {
    const { data: qrData } = await supabase.storage
      .from('teacher-assets')
      .createSignedUrl(config.qr_path, 3600);
    qrUrl = qrData?.signedUrl ?? null;
  }

  let bio: string[] = DEFAULT_BIO;
  if (config?.bio) {
    const raw = config.bio;
    if (Array.isArray(raw) && raw.length > 0) {
      bio = raw.map(String);
    } else if (typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).paragraphs) && (raw as Record<string, string[]>).paragraphs.length > 0) {
      bio = (raw as Record<string, string[]>).paragraphs.map(String);
    }
  }

  return {
    displayName,
    displayPlaceholder: displayName.charAt(0),
    title: config?.title ?? null,
    bio,
    photoUrl,
    qrUrl,
    subjects: [],
  };
}
