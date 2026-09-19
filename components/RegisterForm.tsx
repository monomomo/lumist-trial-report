'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getTeacherPasswordError } from '@/lib/auth/password';
import { isValidUsername } from '@/lib/auth/username';

export function RegisterForm() {
  const router = useRouter();
  const [role, setRole] = useState<'management' | 'sales'>('management');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!isValidUsername(username)) {
      setError('账号格式不正确，请使用 3–32 位字母、数字、点、下划线或短横线。');
      return;
    }
    const passwordError = getTeacherPasswordError(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, displayName, username, password, inviteCode }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '注册失败，请稍后重试。');
      setMessage(`注册成功，请使用账号 ${result.username} 返回登录。`);
      window.setTimeout(() => router.push('/'), 1000);
    } catch (registrationError) {
      setError(registrationError instanceof Error ? registrationError.message : '注册失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <fieldset className="role-picker">
        <legend>注册角色</legend>
        <div className="role-picker-options">
          <label className={`role-option${role === 'management' ? ' selected' : ''}`}>
            <input type="radio" name="role" value="management" checked={role === 'management'} onChange={() => setRole('management')} disabled={loading} />
            <span className="role-option-icon">管</span>
            <span className="role-option-copy"><strong>师资管理</strong><small>管理老师账号与资料</small></span>
            <span className="role-option-check" aria-hidden="true">✓</span>
          </label>
          <label className={`role-option${role === 'sales' ? ' selected' : ''}`}>
            <input type="radio" name="role" value="sales" checked={role === 'sales'} onChange={() => setRole('sales')} disabled={loading} />
            <span className="role-option-icon">销</span>
            <span className="role-option-copy"><strong>销售</strong><small>选择老师并生成报告</small></span>
            <span className="role-option-check" aria-hidden="true">✓</span>
          </label>
        </div>
      </fieldset>
      <label>姓名<input type="text" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={40} required disabled={loading} /></label>
      <label>登录账号<input type="text" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" minLength={3} maxLength={32} required disabled={loading} /></label>
      <label>密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={6} required disabled={loading} /></label>
      <label>邀请码<input type="password" value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} autoComplete="off" required disabled={loading} /></label>
      {error ? <div className="auth-error">{error}</div> : null}
      {message ? <div className="auth-success">{message}</div> : null}
      <button type="submit" disabled={loading}>{loading ? '正在注册…' : '完成注册'}</button>
    </form>
  );
}
