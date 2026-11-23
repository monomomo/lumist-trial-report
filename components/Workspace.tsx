'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ChangePasswordDialog } from '@/components/ChangePasswordDialog';
import type { AppRole } from '@/lib/auth/current-user';
import { useRef, useState } from 'react';

export function Workspace({ username, role = 'teacher' }: { username?: string; role?: AppRole }) {
  const router = useRouter();
  const isDemo = !username;
  const [error, setError] = useState('');
  const accountMenu = useRef<HTMLDetailsElement>(null);
  const roleLabel = role === 'management' ? '师资管理' : role === 'sales' ? '销售' : '老师';

  async function signOut() {
    if (isDemo) return;
    if (accountMenu.current) accountMenu.current.open = false;
    setError('');
    try {
      const supabase = createClient();
      const result = await supabase.auth.signOut();
      if (result.error) throw result.error;
      router.refresh();
    } catch {
      setError('退出登录暂未完成，请检查网络后重试。当前页面仍保留，请先保存未完成的报告。');
    }
  }

  async function enterDemo() {
    router.refresh();
  }

  return (
    <main className="workspace-shell">
      <header className="workspace-topbar">
        <div className="workspace-heading"><strong>路觅教育{roleLabel}工作台</strong>{isDemo && <span className="demo-badge">Demo 模式</span>}</div>
        {isDemo
          ? <button type="button" onClick={enterDemo}>重新进入</button>
          : <details className="workspace-account" ref={accountMenu} onBlur={(event) => {
            if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
          }} onKeyDown={(event) => {
            if (event.key !== 'Escape' || (event.target as HTMLElement).closest('.password-modal')) return;
            event.currentTarget.open = false;
            event.currentTarget.querySelector('summary')?.focus();
          }}>
            <summary><span>{username}</span></summary>
            <div className="workspace-account-actions">
              <ChangePasswordDialog username={username} />
              <button type="button" onClick={signOut}>退出登录</button>
            </div>
          </details>
        }
      </header>
      {error ? <div className="auth-error" role="alert">{error}</div> : null}
      <iframe onFocus={() => { if (accountMenu.current) accountMenu.current.open = false; }} className="report-frame" src="/report/index.html" title="路觅教育试听课报告生成器" />
    </main>
  );
}
