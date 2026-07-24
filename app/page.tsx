import { getAuthResult, AUTH_STATUS } from '@/lib/auth/current-user';
import { LoginForm } from '@/components/LoginForm';
import { Workspace } from '@/components/Workspace';

export default async function Home() {
  const auth = await getAuthResult();

  if (auth.status === AUTH_STATUS.AUTHENTICATED) {
    return <Workspace email={auth.user!.email} />;
  }

  const errorMessage = auth.status === AUTH_STATUS.SUPABASE_NOT_CONFIGURED
    ? '系统未配置认证服务，请联系管理员配置 Supabase 环境变量。'
    : undefined;

  return (
    <main className="auth-shell">
      <aside className="auth-brand">
        <div>
          <small>LUMIST</small>
          <strong>路觅教育</strong>
        </div>
        <div>
          <h1>老师工作台</h1>
          <p>登录后即可使用 AI 试听课报告生成器，创建个性化学习报告与销售跟进卡。</p>
        </div>
        <p>已预先创建老师账号，无需注册。请联系管理员获取登录信息。</p>
      </aside>
      <div className="auth-panel">
        <div className="auth-card">
          <span>老师登录</span>
          <h2>欢迎回来</h2>
          <p>请使用公司分配的工作邮箱和密码登录。</p>
          <LoginForm error={errorMessage} />
        </div>
      </div>
    </main>
  );
}
