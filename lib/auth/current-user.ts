import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

/** 认证状态枚举。 */
export const AUTH_STATUS = {
  /** Supabase 未配置时返回 503 而非硬错。 */
  SUPABASE_NOT_CONFIGURED: 'SUPABASE_NOT_CONFIGURED',
  /** 用户未登录。 */
  NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',
  /** 已登录。 */
  AUTHENTICATED: 'AUTHENTICATED',
} as const;

export type AuthStatusValue = (typeof AUTH_STATUS)[keyof typeof AUTH_STATUS];

export interface AuthResultBase {
  status: AuthStatusValue;
  user: { id: string; email: string } | null;
}

export interface AuthenticatedResult extends AuthResultBase {
  status: typeof AUTH_STATUS.AUTHENTICATED;
  user: { id: string; email: string };
}

export type AuthResult = AuthResultBase | AuthenticatedResult;

/** 获取当前请求的认证状态和用户信息。 */
export async function getAuthResult(): Promise<AuthResult> {
  if (!isSupabaseConfigured) {
    return { status: AUTH_STATUS.SUPABASE_NOT_CONFIGURED, user: null };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { status: AUTH_STATUS.NOT_AUTHENTICATED, user: null };
  }

  return {
    status: AUTH_STATUS.AUTHENTICATED,
    user: { id: user.id, email: user.email ?? '' },
  };
}
