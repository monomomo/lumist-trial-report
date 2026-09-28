import Link from 'next/link';
import { RegisterForm } from '@/components/RegisterForm';

export default function RegisterPage() {
  return (
    <main className="auth-shell">
      <aside className="auth-brand">
        <div><small>LUMIST</small><strong>路觅教育</strong></div>
        <div><h1>内部账号注册</h1><p>仅限持有对应邀请码的师资管理和销售人员使用。</p></div>
        <p>老师账号由师资管理人员创建，不在此页面注册。</p>
      </aside>
      <div className="auth-panel">
        <div className="auth-card">
          <span>内部注册</span>
          <h2>创建工作账号</h2>
          <p>请选择角色并填写对应邀请码。</p>
          <RegisterForm />
          <Link className="auth-link" href="/">返回登录</Link>
        </div>
      </div>
    </main>
  );
}
