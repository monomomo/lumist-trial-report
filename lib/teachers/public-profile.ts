import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

export interface TeacherPublicProfile {
  displayName: string;
  displayPlaceholder: string;
  title: string | null;
  summary: string | null;
  bio: string[];
  sections: TeacherProfileSection[];
  photoUrl: string | null;
  qrUrl: string | null;
  subjects: string[];
}

export interface TeacherProfileSection {
  title: string;
  content: string[];
}

export interface TeacherAssetReference {
  source: 'public' | 'storage';
  path: string;
}

export interface TeacherProfileSnapshot {
  displayName: string;
  title: string | null;
  summary: string | null;
  bio: string[];
  sections: TeacherProfileSection[];
  subjects: string[];
  photoAsset: TeacherAssetReference | null;
  qrAsset: TeacherAssetReference | null;
}

export const PRESET_TEACHER_PROFILES: Record<string, TeacherPublicProfile> = {
  amberlyu: {
    displayName: 'Amber',
    displayPlaceholder: 'A',
    title: 'AP 数学与计算机课程导师',
    summary: '数学、计算机与工程实践背景兼备，注重知识体系、真实题型与长期学科发展的结合。',
    bio: [
      '华盛顿大学数学专业本科，佐治亚理工大学计算机硕士，专业课程平均绩点 3.8/4.0；AP Calculus BC 5 分、SAT 数学满分。',
      '拥有 4 年以上 Lumist 导师经验，累计辅导学生上百位，熟悉北美高中与 AP 课程体系，主授 AP Precalculus、AP Calculus AB/BC 与 AP Computer Science A。',
      '曾供职于华为成都研究所与联想集团，具备扎实的数学、计算机和工程实践背景，擅长 Java、Python、数据结构与算法教学。',
      '注重知识体系与真题训练结合，通过个性化学习规划帮助学生理解抽象概念、建立清晰解题路径，并兼顾考试表现与长期学科发展。',
    ],
    sections: [
      {
        title: '教育与专业背景',
        content: ['华盛顿大学数学专业本科，佐治亚理工大学计算机硕士，专业课程平均绩点 3.8/4.0；AP Calculus BC 5 分、SAT 数学满分。'],
      },
      {
        title: '教学与行业经验',
        content: ['拥有 4 年以上 Lumist 导师经验，累计辅导学生上百位；曾供职于华为成都研究所与联想集团。'],
      },
      {
        title: '擅长领域',
        content: ['AP Precalculus、AP Calculus AB/BC、SAT 数学、AP Computer Science A、Java、Python、数据结构与算法。'],
      },
      {
        title: '教学风格',
        content: ['注重知识体系与真实题型结合，通过个性化规划处理学生薄弱点，并兼顾考试表现与长期学科发展。'],
      },
    ],
    photoUrl: '/report/assets/amberlyu-photo.png',
    qrUrl: '/report/assets/amber-qr.png',
    subjects: ['AP Precalculus', 'AP Calculus AB', 'AP Calculus BC', 'AP Computer Science A', 'SAT 数学'],
  },
};

/** 教师资料未配置时的默认 bio。 */
export const DEFAULT_BIO: string[] = [
  '拥有丰富的教学经验，擅长以清晰的知识框架与真实题目训练帮助学生提升考试表现。',
  '坚持围绕学生薄弱点制定个性化计划，并兼顾考试表现与长期学科发展。',
];

export async function getTeacherPublicProfile(
  userId: string,
  username: string,
): Promise<TeacherPublicProfile | null> {
  const context = await getTeacherProfileContext(userId, username);
  return context?.profile ?? null;
}

export async function getTeacherProfileSnapshot(
  userId: string,
  username: string,
): Promise<TeacherProfileSnapshot | null> {
  const context = await getTeacherProfileContext(userId, username);
  return context?.snapshot ?? null;
}

async function getTeacherProfileContext(
  userId: string,
  username: string,
): Promise<{ profile: TeacherPublicProfile; snapshot: TeacherProfileSnapshot } | null> {
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();

  const [profileResult, configResult] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', userId).single(),
    supabase.from('teacher_configs').select('*').eq('teacher_id', userId).maybeSingle(),
  ]);

  const profile = profileResult.data;
  const config = configResult.data;
  const preset = PRESET_TEACHER_PROFILES[username];

  const displayName = config?.public_name || preset?.displayName || profile?.display_name || username || '老师';

  let photoUrl: string | null = preset?.photoUrl ?? null;
  let qrUrl: string | null = preset?.qrUrl ?? null;
  let photoAsset: TeacherAssetReference | null = preset?.photoUrl
    ? { source: 'public', path: preset.photoUrl }
    : null;
  let qrAsset: TeacherAssetReference | null = preset?.qrUrl
    ? { source: 'public', path: preset.qrUrl }
    : null;

  if (config?.photo_path) {
    photoAsset = { source: 'storage', path: config.photo_path };
    const { data: photoData } = await supabase.storage
      .from('teacher-assets')
      .createSignedUrl(config.photo_path, 3600);
    photoUrl = photoData?.signedUrl ?? null;
  }
  if (config?.qr_path) {
    qrAsset = { source: 'storage', path: config.qr_path };
    const { data: qrData } = await supabase.storage
      .from('teacher-assets')
      .createSignedUrl(config.qr_path, 3600);
    qrUrl = qrData?.signedUrl ?? null;
  }

  let bio: string[] = preset?.bio ?? DEFAULT_BIO;
  if (config?.bio) {
    const raw = config.bio;
    if (Array.isArray(raw) && raw.length > 0) {
      bio = raw.map(String);
    } else if (typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).paragraphs) && (raw as Record<string, string[]>).paragraphs.length > 0) {
      bio = (raw as Record<string, string[]>).paragraphs.map(String);
    }
  }

  const bioObject = config?.bio && typeof config.bio === 'object' && !Array.isArray(config.bio)
    ? config.bio as Record<string, unknown>
    : null;
  const summary = cleanOptionalText(config?.summary)
    || cleanOptionalText(bioObject?.summary)
    || preset?.summary
    || null;
  const sections = normalizeSections(config?.sections).length > 0
    ? normalizeSections(config.sections)
    : normalizeSections(bioObject?.sections).length > 0
      ? normalizeSections(bioObject?.sections)
      : preset?.sections ?? [];
  const subjects = normalizeStringList(config?.subjects).length > 0
    ? normalizeStringList(config.subjects)
    : preset?.subjects ?? [];
  const publicProfile = {
    displayName,
    displayPlaceholder: displayName.charAt(0),
    title: config?.title ?? preset?.title ?? null,
    summary,
    bio,
    sections,
    photoUrl,
    qrUrl,
    subjects,
  };

  return {
    profile: publicProfile,
    snapshot: {
      displayName: publicProfile.displayName,
      title: publicProfile.title,
      summary: publicProfile.summary,
      bio: publicProfile.bio,
      sections: publicProfile.sections,
      subjects: publicProfile.subjects,
      photoAsset,
      qrAsset,
    },
  };
}

function normalizeSections(value: unknown): TeacherProfileSection[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const title = cleanOptionalText(record.title);
    const content = normalizeStringList(record.content);
    return title && content.length > 0 ? [{ title, content }] : [];
  });
}

function normalizeStringList(value: unknown): string[] {
  if (typeof value === 'string') {
    return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  }
  if (!Array.isArray(value)) return [];
  return value.map(String).map((item) => item.trim()).filter(Boolean);
}

function cleanOptionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.trim() || null;
}
