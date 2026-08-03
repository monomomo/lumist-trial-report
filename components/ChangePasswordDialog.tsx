'use client';

import { FormEvent, useState } from 'react';
import { getTeacherPasswordError, MIN_TEACHER_PASSWORD_LENGTH } from '@/lib/auth/password';
import { usernameToAuthEmail } from '@/lib/auth/username';
import { createClient } from '@/lib/supabase/client';

export function ChangePasswordDialog({ username }: { username: string }) {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function reset() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setMessage('');
    setSuccess(false);
  }

  function close() {
    if (loading) return;
    setOpen(false);
    reset();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setSuccess(false);
    const passwordError = getTeacherPasswordError(newPassword);
    if (passwordError) {
      setMessage(passwordError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage('两次输入的新密码不一致。');
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: usernameToAuthEmail(username),
      password: currentPassword,
    });
    if (verifyError) {
      setLoading(false);
      setMessage('当前密码不正确，请重新输入。');
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (updateError) {
      setMessage('密码修改失败，请稍后再试。');
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setSuccess(true);
    setMessage('密码修改成功，下次登录请使用新密码。');
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>修改密码</button>
      {open ? (
        <div className="password-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) close();
        }}>
          <section className="password-modal" role="dialog" aria-modal="true" aria-labelledby="change-password-title">
            <header>
              <div>
                <span>账号安全</span>
                <h2 id="change-password-title">修改密码</h2>
              </div>
              <button type="button" className="password-close" onClick={close} disabled={loading} aria-label="关闭修改密码窗口">×</button>
            </header>
            <p>新密码至少 {MIN_TEACHER_PASSWORD_LENGTH} 位，同时包含字母和数字即可。</p>
            <form className="password-form" onSubmit={submit}>
              <label>
                当前密码
                <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required disabled={loading || success} />
              </label>
              <label>
                新密码
                <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={MIN_TEACHER_PASSWORD_LENGTH} required disabled={loading || success} />
              </label>
              <label>
                再输入一次新密码
                <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={MIN_TEACHER_PASSWORD_LENGTH} required disabled={loading || success} />
              </label>
              {message ? <div className={success ? 'password-message success' : 'password-message'}>{message}</div> : null}
              <div className="password-actions">
                <button type="button" onClick={close} disabled={loading}>{success ? '完成' : '取消'}</button>
                {!success ? <button type="submit" className="password-submit" disabled={loading}>{loading ? '正在修改…' : '确认修改'}</button> : null}
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
