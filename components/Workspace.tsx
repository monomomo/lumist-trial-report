'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function Workspace({ email }: { email?: string }) {
  const router = useRouter();
  const isDemo = !email;

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
        <div><strong>路觅教育老师工作台</strong>{email ? <span>{email}</span> : <span className="demo-badge">Demo 模式</span>}</div>
        {isDemo
          ? <button type="button" onClick={enterDemo}>重新进入</button>
          : <button type="button" onClick={signOut}>退出登录</button>
        }
      </header>
      <iframe className="report-frame" src="/report/index.html" title="路觅教育试听课报告生成器" />
    </main>
  );
}
