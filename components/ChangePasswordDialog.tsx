'use client';

import { FormEvent, useState } from 'react';
import { Alert, Button, Input, Modal } from 'antd';
import { getTeacherPasswordError, MIN_TEACHER_PASSWORD_LENGTH } from '@/lib/auth/password';
import { usernameToAuthEmail } from '@/lib/auth/username';
import { createClient } from '@/lib/supabase/client';
import { getAccountErrorMessage } from '@/lib/auth/error-messages';

export function ChangePasswordDialog({ username, open: controlledOpen, onOpenChange }: {
  username: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const setOpen = onOpenChange ?? setLocalOpen;
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
    try {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: usernameToAuthEmail(username),
        password: currentPassword,
      });
      if (verifyError) {
        setMessage(getAccountErrorMessage(verifyError, 'verify'));
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        setMessage(getAccountErrorMessage(updateError, 'update'));
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess(true);
      setMessage('密码修改成功，下次登录请使用新密码。');
    } catch (error) {
      setMessage(getAccountErrorMessage(error instanceof Error ? error : null, 'update'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
    {controlledOpen === undefined && <Button onClick={() => setOpen(true)}>修改密码</Button>}
    <Modal title="修改密码" open={open} onCancel={close} closable={!loading} maskClosable={!loading} keyboard={!loading} footer={null}>
      <p>新密码至少 {MIN_TEACHER_PASSWORD_LENGTH} 位，需同时包含字母和数字。</p>
      <form className="password-form" onSubmit={submit}>
        <label>当前密码<Input.Password value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required disabled={loading || success} /></label>
        <label>新密码<Input.Password value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={MIN_TEACHER_PASSWORD_LENGTH} required disabled={loading || success} /></label>
        <label>再输入一次新密码<Input.Password value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={MIN_TEACHER_PASSWORD_LENGTH} required disabled={loading || success} /></label>
        {message && <Alert type={success ? 'success' : 'error'} title={message} showIcon />}
        <div className="password-actions">
          <Button danger={!success} onClick={close} disabled={loading}>{success ? '完成' : '取消'}</Button>
          {!success && <Button type="primary" htmlType="submit" loading={loading}>确认修改</Button>}
        </div>
      </form>
    </Modal>
    </>
  );
}
