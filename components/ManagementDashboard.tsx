'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChangePasswordDialog } from '@/components/ChangePasswordDialog';

type Teacher = {
  id: string;
  username: string;
  displayName: string;
  active: boolean;
  publicName: string;
  title: string;
  summary: string;
  bio: string[];
  subjects: string[];
};

const emptyForm = { username: '', password: '', displayName: '', publicName: '', title: '', summary: '', bio: '', subjects: '' };

export function ManagementDashboard({ username }: { username: string }) {
  const router = useRouter();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selected, setSelected] = useState<Teacher | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadTeachers() {
    setLoading(true);
    const response = await fetch('/api/management/teachers');
    const result = await response.json();
    if (!response.ok) setError(result.error || '老师列表读取失败。');
    else setTeachers(result.teachers || []);
    setLoading(false);
  }

  useEffect(() => { void loadTeachers(); }, []);

  function startCreate() {
    setSelected(null);
    setCreating(true);
    setForm(emptyForm);
    setMessage('');
    setError('');
  }

  function startEdit(teacher: Teacher) {
    setSelected(teacher);
    setCreating(false);
    setForm({ username: teacher.username, password: '', displayName: teacher.displayName, publicName: teacher.publicName, title: teacher.title, summary: teacher.summary, bio: teacher.bio.join('\n'), subjects: teacher.subjects.join('\n') });
    setMessage('');
    setError('');
  }

  function updateField(field: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    const payload = { displayName: form.displayName, publicName: form.publicName, title: form.title, summary: form.summary, bio: form.bio.split(/\r?\n/).map((item) => item.trim()).filter(Boolean), subjects: form.subjects.split(/[,\n]/).map((item) => item.trim()).filter(Boolean) };
    const response = await fetch('/api/management/teachers', { method: creating ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(creating ? { ...payload, username: form.username, password: form.password } : { ...payload, teacherId: selected?.id, active: selected?.active ?? true }) });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || '保存失败。');
      return;
    }
    setMessage(creating ? '老师账号已创建。' : '老师资料已更新。');
    setCreating(false);
    setSelected(null);
    setForm(emptyForm);
    await loadTeachers();
  }

  async function toggleActive(teacher: Teacher) {
    const response = await fetch('/api/management/teachers', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teacherId: teacher.id, active: !teacher.active, displayName: teacher.displayName, publicName: teacher.publicName, title: teacher.title, summary: teacher.summary, bio: teacher.bio, subjects: teacher.subjects }) });
    if (!response.ok) {
      const result = await response.json();
      setError(result.error || '账号状态更新失败。');
      return;
    }
    await loadTeachers();
  }

  async function signOut() {
    const { createClient } = await import('@/lib/supabase/client');
    await createClient().auth.signOut();
    router.refresh();
  }

  return <main className="management-shell"><header className="workspace-topbar"><div><strong>路觅教育师资管理</strong><span>账号：{username} · 师资管理</span></div><div className="workspace-actions"><ChangePasswordDialog username={username} /><button type="button" onClick={signOut}>退出登录</button></div></header><section className="management-content"><div className="management-header"><div><span className="management-eyebrow">TEACHER MANAGEMENT</span><h1>老师信息管理</h1><p>创建老师账号，维护报告中展示的老师资料和账号状态。</p></div><button type="button" className="management-primary" onClick={startCreate}>创建老师账号</button></div>{message ? <div className="management-success">{message}</div> : null}{error ? <div className="management-error">{error}</div> : null}<div className="management-grid"><section className="management-card"><h2>老师列表</h2>{loading ? <p>正在读取老师列表…</p> : teachers.length ? <div className="teacher-list">{teachers.map((teacher) => <button type="button" className={`teacher-list-item${selected?.id === teacher.id ? ' selected' : ''}`} key={teacher.id} onClick={() => startEdit(teacher)}><span className="teacher-list-avatar">{teacher.publicName.slice(0, 1)}</span><span><strong>{teacher.publicName}</strong><small>{teacher.username} · {teacher.active ? '正常' : '已停用'}</small></span></button>)}</div> : <p>暂时没有老师账号。</p>}</section>{creating || selected ? <section className="management-card"><h2>{creating ? '创建老师账号' : '编辑老师资料'}</h2><form className="management-form" onSubmit={submit}><label>登录账号<input value={form.username} onChange={(event) => updateField('username', event.target.value)} disabled={!creating} required /></label>{creating ? <label>初始密码<input type="password" value={form.password} onChange={(event) => updateField('password', event.target.value)} minLength={6} required /></label> : null}<label>内部姓名<input value={form.displayName} onChange={(event) => updateField('displayName', event.target.value)} required /></label><label>报告展示名<input value={form.publicName} onChange={(event) => updateField('publicName', event.target.value)} required /></label><label>展示职位<input value={form.title} onChange={(event) => updateField('title', event.target.value)} /></label><label>简介摘要<textarea value={form.summary} onChange={(event) => updateField('summary', event.target.value)} rows={3} /></label><label>老师简介（每行一条）<textarea value={form.bio} onChange={(event) => updateField('bio', event.target.value)} rows={6} /></label><label>擅长科目（每行或逗号分隔）<textarea value={form.subjects} onChange={(event) => updateField('subjects', event.target.value)} rows={3} /></label>{!creating ? <label className="management-checkbox"><input type="checkbox" checked={selected?.active ?? false} onChange={(event) => setSelected((current) => current ? { ...current, active: event.target.checked } : current)} /> 账号启用</label> : null}<div className="management-actions"><button type="submit" className="management-primary">保存</button><button type="button" onClick={() => { setCreating(false); setSelected(null); setForm(emptyForm); }}>取消</button></div></form></section> : <section className="management-card management-empty"><h2>选择老师</h2><p>点击左侧老师查看和编辑资料，或创建新的老师账号。</p></section>}</div></section></main>;
}
