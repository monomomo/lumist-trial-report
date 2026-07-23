'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function Workspace({ email, demo }: { email?: string; demo?: boolean }) {
  const router = useRouter();

  async function signOut() {
    if (!demo) {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.refresh();
    }
  }

  return (
    <main className="workspace-shell">
      <header className="workspace-topbar">
        <div><strong>路觅教育老师工作台</strong><span>{demo ? '内部试用版' : email}</span></div>
        {demo ? null : <button type="button" onClick={signOut}>退出登录</button>}
      </header>
      <iframe className="report-frame" src="/report/index.html" title="路觅教育试听课报告生成器" />
    </main>
  );
}
