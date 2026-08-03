'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ChangePasswordDialog } from '@/components/ChangePasswordDialog';

export function Workspace({ username }: { username?: string }) {
  const router = useRouter();
  const isDemo = !username;

  async function signOut() {
    if (isDemo) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
  }

  async function enterDemo() {
    router.refresh();
  }

  return (
    <main className="workspace-shell">
      <header className="workspace-topbar">
        <div><strong>路觅教育老师工作台</strong>{username ? <span>账号：{username}</span> : <span className="demo-badge">Demo 模式</span>}</div>
        {isDemo
          ? <button type="button" onClick={enterDemo}>重新进入</button>
          : <div className="workspace-actions"><ChangePasswordDialog username={username} /><button type="button" onClick={signOut}>退出登录</button></div>
        }
      </header>
      <iframe className="report-frame" src="/report/index.html" title="路觅教育试听课报告生成器" />
    </main>
  );
}
