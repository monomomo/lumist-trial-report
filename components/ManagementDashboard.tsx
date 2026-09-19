'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
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
  employmentType: 'full_time' | 'part_time' | null;
  photoPath: string;
  qrPath: string;
  photoUrl: string;
  qrUrl: string;
};

type StatusFilter = 'all' | 'active' | 'inactive';
type SortOption = 'name' | 'username' | 'status';
type EmploymentFilter = 'all' | 'full_time' | 'part_time' | 'unset';

const PAGE_SIZE = 12;
const emptyForm = { username: '', password: '', displayName: '', publicName: '', title: '', summary: '', bio: '', subjects: '', employmentType: '' };

function chineseName(value: string) {
  return value.match(/[\u3400-\u9fff]+/g)?.join('') || '';
}

export function ManagementDashboard({ username }: { username: string }) {
  const router = useRouter();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selected, setSelected] = useState<Teacher | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [employmentFilter, setEmploymentFilter] = useState<EmploymentFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState<'photo' | 'qr' | null>(null);

  async function loadTeachers() {
    setLoading(true);
    const response = await fetch('/api/management/teachers');
    const result = await response.json();
    if (!response.ok) setError(result.error || '老师列表读取失败。');
    else setTeachers(result.teachers || []);
    setLoading(false);
  }

  useEffect(() => { void loadTeachers(); }, []);
  useEffect(() => { setPage(1); }, [query, statusFilter, subjectFilter, employmentFilter, sortBy]);

  const subjectOptions = useMemo(() => Array.from(new Set(teachers.flatMap((teacher) => teacher.subjects).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'zh-CN')), [teachers]);

  const filteredTeachers = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase();
    return teachers.filter((teacher) => {
      const matchesQuery = !keyword || [teacher.publicName, teacher.displayName, teacher.username, teacher.title, ...teacher.subjects].some((value) => value.toLocaleLowerCase().includes(keyword));
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? teacher.active : !teacher.active);
      const matchesSubject = subjectFilter === 'all' || teacher.subjects.includes(subjectFilter);
      const matchesEmployment = employmentFilter === 'all' || (employmentFilter === 'unset' ? !teacher.employmentType : teacher.employmentType === employmentFilter);
      return matchesQuery && matchesStatus && matchesSubject && matchesEmployment;
    }).sort((a, b) => {
      if (sortBy === 'username') return a.username.localeCompare(b.username, 'zh-CN');
      if (sortBy === 'status') return Number(b.active) - Number(a.active) || a.publicName.localeCompare(b.publicName, 'zh-CN');
      return a.publicName.localeCompare(b.publicName, 'zh-CN');
    });
  }, [teachers, query, statusFilter, subjectFilter, employmentFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredTeachers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleTeachers = filteredTeachers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const hasFilters = Boolean(query || statusFilter !== 'all' || subjectFilter !== 'all' || employmentFilter !== 'all' || sortBy !== 'name');
  const editorOpen = creating || Boolean(selected);

  useEffect(() => {
    if (!editorOpen) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeEditor();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [editorOpen]);

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
    setForm({ username: teacher.username, password: '', displayName: chineseName(teacher.displayName), publicName: teacher.publicName, title: teacher.title, summary: teacher.summary, bio: teacher.bio.join('\n'), subjects: teacher.subjects.join('\n'), employmentType: teacher.employmentType || '' });
    setMessage('');
    setError('');
  }

  function updateField(field: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function closeEditor() {
    setCreating(false);
    setSelected(null);
    setForm(emptyForm);
  }

  function resetFilters() {
    setQuery('');
    setStatusFilter('all');
    setSubjectFilter('all');
    setEmploymentFilter('all');
    setSortBy('name');
  }

  async function uploadAsset(kind: 'photo' | 'qr', file: File | undefined) {
    if (!selected || !file) return;
    setUploading(kind);
    setError('');
    setMessage('');
    const body = new FormData();
    body.set('teacherId', selected.id);
    body.set('kind', kind);
    body.set('file', file);
    const response = await fetch('/api/management/teachers/assets', { method: 'POST', body });
    const result = await response.json();
    if (!response.ok) setError(result.error || '图片上传失败。');
    else {
      const nextTeacher = { ...selected, [kind === 'photo' ? 'photoPath' : 'qrPath']: result.path, [kind === 'photo' ? 'photoUrl' : 'qrUrl']: result.url };
      setSelected(nextTeacher);
      setTeachers((current) => current.map((teacher) => teacher.id === selected.id ? nextTeacher : teacher));
      setMessage(kind === 'photo' ? '老师职业照已上传。' : '授课视频二维码已上传。');
    }
    setUploading(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    const payload = { displayName: form.displayName, publicName: form.publicName, title: form.title, summary: form.summary, bio: form.bio.split(/\r?\n/).map((item) => item.trim()).filter(Boolean), subjects: form.subjects.split(/[,\n]/).map((item) => item.trim()).filter(Boolean), employmentType: form.employmentType || null };
    const response = await fetch('/api/management/teachers', { method: creating ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(creating ? { ...payload, username: form.username, password: form.password } : { ...payload, teacherId: selected?.id, active: selected?.active ?? true }) });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || '保存失败。');
      return;
    }
    setMessage(creating ? '老师账号已创建。' : '老师资料已更新。');
    closeEditor();
    await loadTeachers();
  }

  async function signOut() {
    const { createClient } = await import('@/lib/supabase/client');
    await createClient().auth.signOut();
    router.refresh();
  }

  return (
    <main className="management-shell">
      <header className="workspace-topbar">
        <div><strong>路觅教育师资管理</strong><span>账号：{username} · 师资管理</span></div>
        <div className="workspace-actions"><ChangePasswordDialog username={username} /><button type="button" onClick={signOut}>退出登录</button></div>
      </header>
      <section className="management-content">
        <div className="management-header">
          <div><span className="management-eyebrow">TEACHER MANAGEMENT</span><h1>老师信息管理</h1><p>快速查找老师，维护报告展示资料和账号状态。</p></div>
          <button type="button" className="management-primary" onClick={startCreate}>创建老师账号</button>
        </div>
        {message ? <div className="management-success">{message}</div> : null}
        {error ? <div className="management-error">{error}</div> : null}
        <div className="management-grid directory-only">
          <section className="management-card teacher-directory">
            <div className="teacher-directory-heading"><div><h2>老师目录</h2><p>共 {teachers.length} 位老师，当前找到 {filteredTeachers.length} 位</p></div></div>
            <div className="teacher-directory-toolbar">
              <label className="teacher-search"><span>搜索</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="姓名、账号、职位或科目" /></label>
              <label><span>账号状态</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}><option value="all">全部状态</option><option value="active">正常</option><option value="inactive">已停用</option></select></label>
              <label><span>擅长科目</span><select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}><option value="all">全部科目</option>{subjectOptions.map((subject) => <option value={subject} key={subject}>{subject}</option>)}</select></label>
              <label><span>用工类型</span><select value={employmentFilter} onChange={(event) => setEmploymentFilter(event.target.value as EmploymentFilter)}><option value="all">全部类型</option><option value="full_time">全职</option><option value="part_time">兼职</option><option value="unset">未设置</option></select></label>
              <label><span>排序</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortOption)}><option value="name">按展示名</option><option value="username">按账号</option><option value="status">启用优先</option></select></label>
              {hasFilters ? <button type="button" className="teacher-filter-reset" onClick={resetFilters}>清除筛选</button> : null}
            </div>
            {loading ? <p>正在读取老师列表…</p> : visibleTeachers.length ? (
              <div className="teacher-list">
                {visibleTeachers.map((teacher) => (
                  <button type="button" className={`teacher-list-item${selected?.id === teacher.id ? ' selected' : ''}`} key={teacher.id} onClick={() => startEdit(teacher)}>
                    <span className="teacher-list-avatar">{(teacher.publicName || teacher.displayName || teacher.username).slice(0, 1)}</span>
                    <span className="teacher-list-content">
                      <span className="teacher-list-title"><strong>{teacher.publicName || teacher.displayName}</strong><em className={`teacher-status ${teacher.active ? 'active' : 'inactive'}`}>{teacher.active ? '正常' : '已停用'}</em></span>
                      <small>中文姓名：{chineseName(teacher.displayName) || '未填写'} · 账号：{teacher.username}</small>
                      <span className="teacher-card-meta"><span>{teacher.employmentType === 'full_time' ? '全职' : teacher.employmentType === 'part_time' ? '兼职' : '未设置类型'}</span>{teacher.title ? <span>{teacher.title}</span> : null}</span>
                      <span className="teacher-subjects">{teacher.subjects.slice(0, 3).map((subject) => <span key={subject}>{subject}</span>)}{teacher.subjects.length > 3 ? <span>+{teacher.subjects.length - 3}</span> : null}{teacher.subjects.length === 0 ? <span>未填写科目</span> : null}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : <div className="teacher-no-results"><strong>没有找到符合条件的老师</strong><p>可以调整搜索词或清除筛选条件。</p>{hasFilters ? <button type="button" onClick={resetFilters}>清除筛选</button> : null}</div>}
            {!loading && filteredTeachers.length > PAGE_SIZE ? <div className="teacher-pagination"><button type="button" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>上一页</button><span>第 {currentPage} / {totalPages} 页</span><button type="button" disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>下一页</button></div> : null}
          </section>
        </div>
        {editorOpen ? (
          <div className="teacher-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEditor(); }}>
            <section className="management-card teacher-editor" role="dialog" aria-modal="true" aria-labelledby="teacher-editor-title">
              <div className="teacher-editor-heading"><div><h2 id="teacher-editor-title">{creating ? '创建老师账号' : '编辑老师资料'}</h2>{selected ? <p>{selected.publicName} · {selected.username}</p> : null}</div><button type="button" onClick={closeEditor}>关闭</button></div>
              <form className="management-form" onSubmit={submit}>
                <label>登录账号<input value={form.username} onChange={(event) => updateField('username', event.target.value)} disabled={!creating} required /></label>
                {creating ? <label>初始密码<input type="password" value={form.password} onChange={(event) => updateField('password', event.target.value)} minLength={6} required /></label> : null}
                <label>中文姓名<input value={form.displayName} onChange={(event) => updateField('displayName', event.target.value)} required /></label>
                <label>报告展示名<input value={form.publicName} onChange={(event) => updateField('publicName', event.target.value)} required /></label>
                <label>用工类型<select value={form.employmentType} onChange={(event) => updateField('employmentType', event.target.value)}><option value="">未设置</option><option value="full_time">全职</option><option value="part_time">兼职</option></select></label>
                <label>展示职位<input value={form.title} onChange={(event) => updateField('title', event.target.value)} /></label>
                <label>简介摘要<textarea value={form.summary} onChange={(event) => updateField('summary', event.target.value)} rows={3} /></label>
                <label>老师简介（每行一条）<textarea value={form.bio} onChange={(event) => updateField('bio', event.target.value)} rows={6} /></label>
                <label>擅长科目（每行或逗号分隔）<textarea value={form.subjects} onChange={(event) => updateField('subjects', event.target.value)} rows={3} /></label>
                {!creating ? <label className="management-checkbox"><input type="checkbox" checked={selected?.active ?? false} onChange={(event) => setSelected((current) => current ? { ...current, active: event.target.checked } : current)} /> 账号启用</label> : null}
                {!creating && selected ? <div className="teacher-assets"><div className="teacher-asset"><div className="teacher-asset-preview">{selected.photoUrl ? <img src={selected.photoUrl} alt={`${selected.displayName}职业照`} /> : <span>暂无职业照</span>}</div><label>老师职业照<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading !== null} onChange={(event) => void uploadAsset('photo', event.target.files?.[0])} /></label><small>支持 JPG、PNG、WebP，最大 5MB</small>{uploading === 'photo' ? <em>上传中…</em> : null}</div><div className="teacher-asset"><div className="teacher-asset-preview qr">{selected.qrUrl ? <img src={selected.qrUrl} alt={`${selected.displayName}授课视频二维码`} /> : <span>暂无二维码</span>}</div><label>授课视频二维码<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading !== null} onChange={(event) => void uploadAsset('qr', event.target.files?.[0])} /></label><small>支持 JPG、PNG、WebP，最大 3MB</small>{uploading === 'qr' ? <em>上传中…</em> : null}</div></div> : creating ? <p className="teacher-asset-note">创建账号后即可上传职业照和授课视频二维码。</p> : null}
                <div className="management-actions"><button type="submit" className="management-primary">保存</button><button type="button" onClick={closeEditor}>取消</button></div>
              </form>
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}
