'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function LoginForm({ error: externalError }: { error?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isDisabled = Boolean(externalError);
  const displayError = externalError || error;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
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
        工作邮箱
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={isDisabled} />
      </label>
      <label>
        密码
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={isDisabled} />
      </label>
      {displayError ? <div className="auth-error">{displayError}</div> : null}
      <button type="submit" disabled={loading || isDisabled}>{loading ? '正在登录…' : '进入老师工作台'}</button>
    </form>
  );
}
