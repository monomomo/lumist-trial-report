'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ChangePasswordDialog } from '@/components/ChangePasswordDialog';
import type { AppRole } from '@/lib/auth/current-user';
import { useEffect, useRef, useState } from 'react';
import { Button, ConfigProvider, Dropdown } from 'antd';
import { DownOutlined, UserOutlined } from '@ant-design/icons';

export function Workspace({ username, role = 'teacher' }: { username?: string; role?: AppRole }) {
  const router = useRouter();
  const isDemo = !username;
  const [error, setError] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const sidebarObserver = useRef<MutationObserver | null>(null);
  useEffect(() => () => sidebarObserver.current?.disconnect(), []);

  function observeSidebar() {
    sidebarObserver.current?.disconnect();
    const sidebar = frame.current?.contentDocument?.querySelector('.sidebar');
    if (!sidebar) return;
    const update = () => setCollapsed(sidebar.classList.contains('sidebar-collapsed'));
    update();
    sidebarObserver.current = new MutationObserver(update);
    sidebarObserver.current.observe(sidebar, { attributes: true, attributeFilter: ['class'] });
  }
  const roleLabel = role === 'management' ? '师资管理' : role === 'sales' ? '销售' : '老师';

  async function signOut() {
    if (isDemo) return;
    setAccountOpen(false);
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

  const name = username || '演示老师';
  return (
    <main className="workspace-shell report-account-shell" data-sidebar-collapsed={collapsed}>
      <ConfigProvider theme={{ token: { colorPrimary: '#946515', colorBgElevated: '#fffaf1', borderRadius: 6 } }}>
        <header className="workspace-topbar workspace-account-bar">
          <div className="workspace-heading"><strong>路觅教育{roleLabel}工作台</strong></div>
          <Dropdown open={accountOpen} onOpenChange={setAccountOpen} trigger={['click']} menu={{
            items: isDemo
              ? [{ key: 'demo', label: '本地演示 · 未登录', disabled: true }, { key: 'refresh', label: '重新进入' }]
              : [{ key: 'password', label: '修改密码' }, { key: 'signout', label: '退出登录', danger: true }],
            onClick: ({ key }) => {
              setAccountOpen(false);
              if (key === 'password') setPasswordOpen(true);
              else if (key === 'signout') void signOut();
              else if (key === 'refresh') void enterDemo();
            },
          }}>
            <Button type="text" className="workspace-account-trigger" aria-label={`${name}，账户操作`} aria-expanded={accountOpen} title={name} icon={<UserOutlined aria-hidden="true" />}>
              <span className="workspace-account-name">{name}</span><DownOutlined className="workspace-account-chevron" aria-hidden="true" />
            </Button>
          </Dropdown>
        </header>
        {username && <ChangePasswordDialog username={username} open={passwordOpen} onOpenChange={setPasswordOpen} />}
      </ConfigProvider>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <iframe ref={frame} onLoad={observeSidebar} onFocus={() => setAccountOpen(false)} className="report-frame" src="/report/index.html" title="路觅教育试听课报告生成器" />
    </main>
  );
}
