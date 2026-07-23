import { LoginForm } from '@/components/LoginForm';
import { Workspace } from '@/components/Workspace';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

export default async function Home() {
  if (!isSupabaseConfigured) {
    return <Workspace demo />;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    return <Workspace email={user.email} />;
  }

  return (
    <main className="auth-shell">
      <section className="auth-brand">
        <div><small>LUMIST</small><strong>路觅教育</strong></div>
        <div><h1>把课堂判断，变成一份专业学习报告。</h1><p>老师只需要记录真实课堂情况，系统负责整理学情、课程规划和销售跟进建议。</p></div>
        <small>TEACHER WORKSPACE · INTERNAL</small>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <span>SAT 试听课报告系统</span>
          <h2>老师登录</h2>
          <p>使用公司分配的账号进入。学生报告与销售跟进内容仅限内部使用。</p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
