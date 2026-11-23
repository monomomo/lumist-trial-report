import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { Button, Checkbox, ConfigProvider, Dropdown, Input, Menu, Radio, Segmented, Select, Upload } from 'antd';
import { InboxOutlined, DownOutlined, UpOutlined, FileAddOutlined, HistoryOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';

const theme = {
  token: {
    colorPrimary: '#946515',
    colorText: '#302719',
    colorBgContainer: '#fffdf8',
    colorBgElevated: '#fffdf8',
    colorBorder: '#e1d0b1',
    colorFillSecondary: '#f7edda',
    borderRadius: 6,
    controlHeight: 38,
    fontFamily: 'inherit',
  },
  components: {
    Menu: {
      darkItemBg: '#2c2415',
      darkItemColor: '#fff1d3',
      darkItemSelectedBg: '#513d1d',
      darkItemSelectedColor: '#ffdd80',
      darkItemHoverBg: '#40331e',
      darkItemHoverColor: '#ffdd80',
      itemMarginInline: 0,
      itemPaddingInline: 12,
      collapsedWidth: 42,
    },
    Segmented: {
      trackBg: '#f5ead6',
      itemSelectedBg: '#fffaf1',
      itemSelectedColor: '#6f4706',
      itemColor: '#5f4a32',
    },
    Select: { optionSelectedBg: '#fff0c5', optionActiveBg: '#f7edda' },
  },
};

// The native controls remain the source of truth for form validation, existing report events and the print workflow.
const selectors = [
  '#report-form select:not(#subject-select)', '.paper-plan-row select', '.paper-mobile-nav',
  '#report-form input:not([type=radio],[type=checkbox],[type=file],[type=hidden],#subject-search)',
  '#report-form input[type=checkbox], #report-form input[name=regeneration-plan-mode]', '#report-form textarea', '.paper-plan-dialog input', '.paper-plan-dialog textarea',
  '.layout-edit-dialog textarea', '#history-view input:not([type=checkbox])',
  'button.secondary-btn', 'button.primary-btn', 'button.text-btn', 'button.paper-nav-item', '.paper-zoom button',
].join(',');

const controlMap = new Map();
let sequence = 0;

function getAccessibleLabel(control) {
  const label = control.getAttribute('aria-label');
  if (label) return label;
  const nativeLabel = control.labels?.[0];
  if (!nativeLabel) return undefined;
  return Array.from(nativeLabel.childNodes)
    .filter(node => node.nodeType === Node.TEXT_NODE || node.tagName === 'SPAN')
    .filter(node => !node.classList?.contains('report-ui-host'))
    .map(node => node.textContent.trim())
    .filter(Boolean)
    .join(' ') || undefined;
}

function sync(native) {
  const isButton = native.tagName === 'BUTTON';
  return {
    tag: native.tagName,
    classes: Array.from(native.classList).filter(name => name !== 'report-ui-native').join(' '),
    disabled: native.disabled,
    checked: native.checked,
    required: native.required,
    hidden: native.hidden || native.classList.contains('hidden') || getComputedStyle(native).display === 'none',
    invalid: native.getAttribute('aria-invalid'),
    label: getAccessibleLabel(native),
    title: native.title,
    value: native.value,
    placeholder: native.placeholder,
    maxLength: native.maxLength,
    min: native.getAttribute('min'),
    max: native.getAttribute('max'),
    step: native.getAttribute('step'),
    type: native.type,
    rows: native.rows,
    readOnly: native.readOnly,
    inputMode: native.inputMode,
    expanded: native.getAttribute('aria-expanded'),
    busy: native.getAttribute('aria-busy'),
    pressed: native.getAttribute('aria-pressed'),
    current: native.getAttribute('aria-current'),
    loading: isButton && Boolean(native.querySelector('.generation-spinner, .spinner, .button-spinner')),
    text: isButton ? native.textContent.trim() : undefined,
    options: native.options && Array.from(native.options, ({ value, label, disabled }) => ({ value, label, disabled })),
  };
}

function bind(native) {
  const host = document.createElement('span');
  host.className = 'report-ui-host';
  const tabIndex = native.getAttribute('tabindex');
  const ariaHidden = native.getAttribute('aria-hidden');
  const key = sequence++;
  const proxySelector = native.tagName === 'SELECT' ? '[role="combobox"]' : 'input, textarea, button';
  const forwardFocus = () => host.querySelector(proxySelector)?.focus({ preventScroll: true });
  const handle = {
    key, host, native,
    enhance() {
      if (native.classList.contains('report-ui-native')) return;
      native.classList.add('report-ui-native');
      native.tabIndex = -1;
      native.setAttribute('aria-hidden', 'true');
      native.addEventListener('focus', forwardFocus);
    },
    dispose() {
      host.remove();
      native.classList.remove('report-ui-native');
      native.removeEventListener('focus', forwardFocus);
      if (tabIndex === null) native.removeAttribute('tabindex');
      else native.setAttribute('tabindex', tabIndex);
      if (ariaHidden === null) native.removeAttribute('aria-hidden');
      else native.setAttribute('aria-hidden', ariaHidden);
    },
  };
  controlMap.set(native, handle);
  return handle;
}

function Field({ handle, props }) {
  const { native, enhance } = handle;
  const [value, setValue] = useState(props.value);
  const dirty = useRef(false);
  useEffect(() => setValue(props.value), [props.value]);
  useLayoutEffect(enhance, [enhance]);
  const common = {
    disabled: props.disabled,
    'aria-label': props.label,
    'aria-required': props.required || undefined,
    'aria-invalid': props.invalid || undefined,
    'data-ui-control': native.id || undefined,
  };

  function update(next, eventType) {
    if (eventType === 'input') dirty.current = true;
    setValue(next);
    native.value = next;
    native.dispatchEvent(new Event(eventType, { bubbles: true }));
  }

  if (props.tag === 'BUTTON') {
    const direction = native.closest('.paper-plan-arrows') ? props.text : null;
    return <Button
      {...common}
      icon={direction === '↑' ? <UpOutlined aria-hidden="true" /> : direction === '↓' ? <DownOutlined aria-hidden="true" /> : undefined}
      className={props.classes}
      type={native.matches('.paper-nav-item,.text-btn') ? 'text' : 'default'}
      title={props.title}
      aria-expanded={props.expanded}
      aria-busy={props.busy}
      aria-live={native.getAttribute('aria-live')}
      aria-pressed={props.pressed}
      aria-current={props.current}
      aria-controls={native.getAttribute('aria-controls')}
      danger={native.matches('[data-cancel-plan]') || /^(取消|删除|移除)/.test(props.text)}
      data-ui-cancel={native.hasAttribute('data-cancel-plan') || undefined}
      loading={props.loading}
      onClick={() => native.click()}
    >{direction ? null : props.text}</Button>;
  }

  if (props.tag === 'SELECT') {
    return <Select
      {...common}
      value={props.options.some(option => option.value === value) ? value : null}
      options={props.options}
      suffixIcon={<DownOutlined aria-hidden="true" />}
      virtual={false}
      popupMatchSelectWidth={native.closest('.paper-plan-row') ? false : true}
      onChange={next => update(next, 'change')}
    />;
  }

  if (props.type === 'checkbox' || props.type === 'radio') {
    const Control = props.type === 'checkbox' ? Checkbox : Radio;
    return <Control {...common} checked={props.checked} onChange={event => {
      native.checked = event.target.checked;
      native.dispatchEvent(new Event('change', { bubbles: true }));
    }} />;
  }

  const Text = props.tag === 'TEXTAREA' ? Input.TextArea : Input;
  return <Text
    {...common}
    className={props.classes}
    type={props.tag === 'INPUT' ? props.type : undefined}
    value={value}
    placeholder={props.placeholder}
    maxLength={props.maxLength >= 0 ? props.maxLength : undefined}
    min={props.min}
    max={props.max}
    step={props.step}
    rows={props.rows}
    inputMode={props.inputMode || undefined}
    readOnly={props.readOnly}
    onChange={event => update(event.target.value, 'input')}
    onBlur={() => {
      if (!dirty.current) return;
      dirty.current = false;
      native.dispatchEvent(new Event('change', { bubbles: true }));
    }}
    onKeyDown={event => {
      if (event.key !== 'Enter' || props.tag !== 'INPUT' || event.nativeEvent.isComposing) return;
      const proceed = native.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: event.key }));
      if (proceed && native.form) native.form.requestSubmit();
      event.preventDefault();
    }}
  />;
}

const sidebar = document.querySelector('.sidebar');
const legacyMenu = sidebar.querySelector('#workspace-nav');
const legacyToggle = sidebar.querySelector('.sidebar-toggle');
const menuHost = document.createElement('div');
const toggleHost = document.createElement('span');
menuHost.className = 'report-menu-host';
toggleHost.className = 'report-menu-toggle-host';
legacyMenu.after(menuHost);
legacyToggle.after(toggleHost);
const menuButtons = Array.from(legacyMenu.querySelectorAll('[data-view]'));
const menuItems = menuButtons.map((button) => ({
  key: button.dataset.view,
  label: button.getAttribute('aria-label'),
  icon: button.dataset.view === 'new' ? <FileAddOutlined /> : <HistoryOutlined />,
}));
const narrow = matchMedia('(max-width:900px)');

function Navigation({ selected, collapsed, mobile }) {
  useEffect(() => sidebar.classList.add('report-menu-enhanced'), []);
  return <>
    {createPortal(<Menu
      id="workspace-nav-menu"
      theme="dark"
      mode={mobile ? 'horizontal' : 'inline'}
      inlineCollapsed={!mobile && collapsed}
      items={menuItems}
      selectedKeys={selected ? [selected] : []}
      onClick={({ key }) => menuButtons.find(button => button.dataset.view === key)?.click()}
    />, menuHost)}
    {createPortal(<Button
      className="report-menu-toggle"
      type="text"
      icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
      aria-label={collapsed ? '展开导航' : '收起导航'}
      title={collapsed ? '展开导航' : '收起导航'}
      aria-expanded={!collapsed}
      aria-controls="workspace-nav-menu"
      onClick={() => legacyToggle.click()}
    />, toggleHost)}
  </>;
}

const stageJump = document.querySelector('.paper-stage-jump');
const stageJumpHost = document.createElement('span');
stageJumpHost.className = 'report-stage-jump-host';
stageJump?.after(stageJumpHost);

function StageJump({ stages }) {
  const [open, setOpen] = useState(false);
  useEffect(() => stageJump?.classList.add('report-stage-jump-enhanced'), []);
  if (!stageJump) return null;
  return createPortal(<Dropdown
    trigger={['click']}
    onOpenChange={setOpen}
    placement="bottomRight"
    autoFocus
    menu={{
      items: stages,
      selectable: true,
      selectedKeys: stages.filter(stage => stage.current).map(stage => stage.key),
      onClick: ({ key }) => stageJump.querySelector(`[data-stage-index="${key}"]`)?.click(),
    }}
  ><Button className="report-stage-jump-trigger" aria-expanded={open} icon={<DownOutlined aria-hidden="true" />} iconPlacement="end">跳转阶段</Button></Dropdown>, stageJumpHost);
}

const generationTabs = document.querySelector('.generation-mode-tabs');
const generationHost = document.createElement('span');
generationHost.className = 'report-generation-mode-host';
generationTabs?.after(generationHost);
const sourceInputs = Array.from(generationTabs?.querySelectorAll('input[type="radio"]') || []);

function GenerationMode({ value, disabled }) {
  useLayoutEffect(() => generationTabs?.classList.add('report-generation-mode-enhanced'), []);
  if (!sourceInputs.length) return null;
  return createPortal(<Segmented
    block
    size="large"
    value={value}
    disabled={disabled}
    aria-label="报告生成方式"
    options={sourceInputs.map(input => ({
      label: input.closest('label')?.querySelector('b')?.textContent || input.value,
      value: input.value,
    }))}
    onChange={next => sourceInputs.find(input => input.value === next)?.click()}
  />, generationHost);
}

const subjectPicker = document.querySelector('#subject-combobox');
const subjectHost = document.createElement('div');
subjectHost.className = 'report-subject-host';
subjectPicker?.after(subjectHost);
const dropzone = document.querySelector('#course-plan-dropzone');
const uploadHost = document.createElement('div');
uploadHost.className = 'report-upload-host';
dropzone?.after(uploadHost);

function SubjectAndUpload({ subject, uploadName, disabled, subjects }) {
  useLayoutEffect(() => {
    subjectPicker?.classList.add('report-ui-replaced');
    dropzone?.classList.add('report-ui-replaced');
  }, []);
  return <>
    {subjectPicker && createPortal(<Select
      aria-label="课程科目"
      virtual={false}
      labelInValue
      showSearch={{ filterOption: false, onSearch: query => subjectPicker.dispatchEvent(new CustomEvent('report-subject-search', { detail: query })) }}
      onOpenChange={open => {
        if (open) subjectPicker.dispatchEvent(new CustomEvent('report-subject-search', { detail: '' }));
      }}
      value={subject}
      options={subjects}
      suffixIcon={<DownOutlined aria-hidden="true" />}
      onChange={({ value: code }) => {
        subjectPicker.dispatchEvent(new CustomEvent('report-subject-choice', { detail: code }));
        subjectPicker.dispatchEvent(new CustomEvent('report-subject-search', { detail: '' }));
      }}
    />, subjectHost)}
    {dropzone && createPortal(<Upload.Dragger
      accept=".docx,.xlsx,.pdf"
      disabled={disabled}
      showUploadList={false}
      beforeUpload={file => {
        dropzone.dispatchEvent(new CustomEvent('report-upload', { detail: file }));
        return Upload.LIST_IGNORE;
      }}
    >
      <InboxOutlined aria-hidden="true" />
      <p>拖拽文件到这里，或点击选择文件</p>
      <small>{uploadName}</small>
    </Upload.Dragger>, uploadHost)}
  </>;
}

function WorkspaceUI() {
  const [snapshot, setSnapshot] = useState(null);
  useEffect(() => {
    let pending = 0;
    let previous = '';
    function update() {
      pending = 0;
      for (const [native, handle] of controlMap) {
        if (!document.body.contains(native)) {
          handle.dispose();
          controlMap.delete(native);
        }
      }
      const controls = Array.from(document.querySelectorAll(selectors)).filter(native => !native.closest('.report-ui-host, .report-subject-host, .report-upload-host, .report-generation-mode-host, [popover]')).map(native => {
        const handle = controlMap.get(native) || bind(native);
        if (native.nextElementSibling !== handle.host) native.after(handle.host);
        const props = sync(native);
        const kind = native.classList.contains('paper-mobile-nav') ? 'mobile-nav' : props.tag.toLowerCase();
        if (['checkbox', 'radio'].includes(props.type)) {
          handle.host.dataset.choice = props.type;
          if (props.label) handle.host.setAttribute('aria-label', props.label);
        }
        if (handle.host.dataset.kind !== kind) handle.host.dataset.kind = kind;
        if (handle.host.hidden !== props.hidden) handle.host.hidden = props.hidden;
        return { handle, props };
      });
      const selected = menuButtons.find(button => button.classList.contains('active'))?.dataset.view;
      const collapsed = sidebar.classList.contains('sidebar-collapsed');
      const mobile = narrow.matches;
      const stages = Array.from(stageJump?.querySelectorAll('[data-stage-index]') || [], control => ({
        key: control.dataset.stageIndex,
        label: control.textContent.trim(),
        current: Boolean(control.getAttribute('aria-current')),
      }));
      const generationMode = {
        value: sourceInputs.find(input => input.checked)?.value,
        disabled: sourceInputs.every(input => input.disabled),
      };
      const subject = document.querySelector('#subject-select');
      const groups = Array.from(subjectPicker?.querySelectorAll('.subject-option-group') || [], group => ({
        label: group.firstElementChild.textContent,
        options: Array.from(group.querySelectorAll('[data-subject-code]'), option => ({
          label: option.querySelector('span').textContent,
          value: option.dataset.subjectCode,
        })),
      }));
      const uploadName = document.querySelector('#course-plan-file-name')?.textContent;
      const disabled = document.querySelector('#course-plan-file')?.disabled;
      const inputTools = {
        subject: subject?.value ? { value: subject.value, label: subjectPicker.querySelector('input').value } : undefined,
        subjects: groups,
        uploadName,
        disabled,
      };
      const signature = JSON.stringify([selected, collapsed, mobile, stages, generationMode, inputTools, controls.map(({ handle, props }) => [handle.key, props])]);
      if (signature === previous) return;
      previous = signature;
      setSnapshot({ controls, selected, collapsed, mobile, stages, generationMode, inputTools });
    }
    function schedule(event) {
      if (event?.target?.closest?.('.report-ui-host') || pending) return;
      pending = requestAnimationFrame(update);
    }
    const observer = new MutationObserver(records => {
      if (records.some(record => !record.target.parentElement?.closest('.report-ui-host, .report-menu-host, .report-menu-toggle-host, .ant-select-dropdown'))) schedule();
    });
    observer.observe(document.body, {
      subtree: true, childList: true, characterData: true, attributes: true,
      attributeFilter: ['class', 'disabled', 'hidden', 'required', 'readonly', 'value', 'label', 'placeholder', 'aria-expanded', 'aria-label', 'aria-busy', 'aria-invalid', 'aria-pressed', 'aria-current', 'min', 'max', 'step'],
    });
    document.addEventListener('input', schedule);
    document.addEventListener('change', schedule);
    narrow.addEventListener('change', schedule);
    update();
    return () => {
      cancelAnimationFrame(pending);
      observer.disconnect();
      document.removeEventListener('input', schedule);
      document.removeEventListener('change', schedule);
      narrow.removeEventListener('change', schedule);
      controlMap.forEach(handle => handle.dispose());
      controlMap.clear();
    };
  }, []);
  if (!snapshot) return null;

  return <ConfigProvider
    theme={theme}
    button={{ autoInsertSpace: false }}
    getPopupContainer={trigger => trigger?.closest('dialog') || document.body}
  >
    <Navigation {...snapshot} />
    <StageJump stages={snapshot.stages} />
    <GenerationMode {...snapshot.generationMode} />
    <SubjectAndUpload {...snapshot.inputTools} />
    {snapshot.controls.map(({ handle, props }) => createPortal(
      <Field handle={handle} props={props} />, handle.host, handle.key
    ))}
  </ConfigProvider>;
}

const root = document.createElement('div');
root.hidden = true;
document.body.append(root);
createRoot(root).render(<WorkspaceUI />);
