'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { isValidUsername, normalizeUsername, usernameToAuthEmail } from '@/lib/auth/username';

export function LoginForm({ error: externalError }: { error?: string }) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isDisabled = Boolean(externalError);
  const displayError = externalError || error;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const normalizedUsername = normalizeUsername(username);
    if (!isValidUsername(normalizedUsername)) {
      setError('账号格式不正确，请输入管理员分配的老师账号。');
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: usernameToAuthEmail(normalizedUsername),
      password,
    });
    setLoading(false);
    if (signInError) {
      setError('账号或密码不正确，请联系管理员确认老师账号。');
      return;
    }
    router.refresh();
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label>
        老师账号
        <input type="text" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" minLength={3} maxLength={32} pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,31}" required disabled={isDisabled} />
      </label>
      <label>
        密码
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required disabled={isDisabled} />
      </label>
      {displayError ? <div className="auth-error">{displayError}</div> : null}
      <button type="submit" disabled={loading || isDisabled}>{loading ? '正在登录…' : '进入老师工作台'}</button>
    </form>
  );
}
