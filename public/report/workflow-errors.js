const INPUT_FIELDS = {
  studentName: ['学生姓名', '#student-name', '请填写学生姓名，最多 30 个字。'],
  teacherNotes: ['试听课反馈', '#teacher-notes', '请填写 20–6000 个字的试听课反馈，写明本节课讲了什么、学生做得怎样；不需要使用专业提示词。'],
  currentScore: ['当前成绩', '#current-score', '请检查当前成绩是否符合所选科目的分数范围；不确定时可以留空。'],
  targetScore: ['目标成绩', '#target-score', '请检查目标成绩，且目标不能低于当前成绩；不确定时可以留空。'],
  examDate: ['考试日期', '#exam-date', '请检查考试日期后重试。'],
  totalHours: ['总课时', '#total-hours', '总课时须为 2–60 小时，支持 0.5 小时；SAT 数学请调整下方各领域课时。'],
  lessonCount: ['预计课次', '#lesson-count', '请调整预计课次，使每次课能安排为 0.5–2 小时；总课时和课次需要分别确认。'],
  planningScenario: ['辅导场景', '#planning-scenario', '请选择预习、同步或冲刺。'],
  planningFocusAreas: ['课程侧重点', '#planning-focus-options', '请重新选择当前科目的课程侧重点，最多 3 项。'],
  subjectCode: ['课程科目', '#subject-search', '请在科目下拉列表中重新选择本次课程。'],
  satMathHours: ['数学领域课时', '#sat-math-hours-grid', '请填齐所有数学领域课时；不安排的项目填 0，每项按 0.5 小时递增。'],
  satEnglishAssessment: ['语言成绩', '#language-test-type', '请检查语言考试类型、分制和成绩；没有成绩时可以不填写。'],
};

const ERRORS = {
  NETWORK_ERROR: ['网络连接中断', '请检查网络后重试，不需要修改课堂记录。', 'network'],
  AI_RATE_LIMITED: ['当前使用人数较多', '请等待 1 分钟后点击“继续生成”，不需要修改课堂记录。', 'service'],
  REQUEST_TIMEOUT: ['本次等待时间较长，服务未能及时响应', '请稍后重试，不需要重新填写课堂记录。', 'service'],
  INVALID_RESPONSE: ['服务暂时没有返回可用结果', '请等待 1 分钟后重试；无需重新填写，也不要连续点击生成。', 'service'],
  AI_GATEWAY_ERROR: ['生成服务暂时无法连接', '请稍后重试，不需要改写课堂记录。', 'service'],
  AI_GENERATION_FAILED: ['AI 本次没有完成报告', '请点击“继续生成”重试，不需要为了这个错误修改课堂记录。', 'model'],
  EMPTY_MODEL_OUTPUT: ['AI 本次没有返回完整内容', '请点击“继续生成”；若仍失败，等待 1 分钟后再试，无需改写课堂记录。', 'model'],
  OUTLINE_LESSON_COUNT_MISMATCH: ['AI 生成的阶段安排与要求的课次不一致', '请点击“继续生成”，由系统重新整理；不需要调整正确填写的课次。', 'model'],
  STAGE_LESSON_COUNT_MISMATCH: ['AI 返回的课程数量不完整', '请点击“继续生成”，系统会重新处理未完成的内容。', 'model'],
  EXAM_TRAINING_LESSON_COUNT_MISMATCH: ['AI 未按要求安排足够的考试训练', '请点击“继续生成”，不需要取消考试训练选项。', 'model'],
  SAT_MATH_HOURS_MISMATCH: ['AI 未遵守您填写的数学领域课时', '请点击“继续生成”，系统会按原课时重新安排。', 'model'],
  INVALID_UNIT_CODE: ['AI 返回的课程章节信息未通过检查', '请点击“继续生成”；这是生成结果的问题，不需要修改正确的课堂记录。', 'model'],
  SYLLABUS_COVERAGE_VIOLATION: ['AI 生成的课程范围未通过检查', '请先确认选对科目，再点击“继续生成”；若科目正确，无需改写课堂记录。', 'model'],
  SUBJECT_SCOPE_VIOLATION: ['AI 生成的内容混入了其他科目', '请先确认选对科目，再点击“继续生成”。', 'model'],
  COURSE_PLAN_STYLE_REPETITION: ['AI 生成的课程内容过于重复', '请点击“继续生成”，不需要改动正确的课堂记录。', 'model'],
  REPORT_QUALITY_FAILED: ['AI 本次生成的报告未达到要求', '请点击“继续生成”，系统会重新处理未通过检查的内容；无需改写正确的课堂记录。', 'model'],
  UNEXPECTED_LANGUAGE: ['AI 生成的内容出现了异常文字', '请点击“继续生成”；无需改变您正常填写的中文或英文内容。', 'model'],
  AI_SERVICE_NOT_CONFIGURED: ['AI 服务暂时不可用', '请联系管理员处理；反复点击生成或修改课堂记录无法解决。', 'service'],
  SYSTEM_NOT_CONFIGURED: ['登录或数据服务暂时不可用', '请保留当前页面，并联系管理员；不要重新填写资料。', 'service'],
  FORBIDDEN: ['当前账号没有这项操作的权限', '请确认使用的是老师或销售账号；仍无法操作时联系管理员。', 'account'],
  LOCKED_PLAN_REQUIRED: ['上传的课程规划还没有确认', '请先上传文件，核对并确认课程规划，再点击生成。', 'input', '#course-plan-upload-panel'],
  LOCKED_PLAN_MISMATCH: ['课程规划与当前课时或课次不一致', '请重新确认课程规划后生成；如果只修改了试听反馈，请保留原规划。', 'input', '#course-plan-upload-panel'],
  AI_MODE_LOCKED_PLAN_FORBIDDEN: ['生成方式切换后，原课程规划尚未清理完成', '请重新选择生成方式后重试；不需要改写课堂记录。', 'service'],
  INVALID_UPLOAD: ['无法读取这份上传文件', '请选择非空的 DOCX、XLSX 或 PDF 文件，大小不超过 8MB，并确认已选择科目。', 'input', '#course-plan-file'],
  UNSUPPORTED_FILE_TYPE: ['暂不支持这种文件格式', '请另存为 DOCX、XLSX 或可复制文字的 PDF，再重新上传。', 'input', '#course-plan-file'],
  EMPTY_DOCUMENT: ['文件中没有识别到可读取的课程文字', '如果是扫描件或图片 PDF，请改传 Word、Excel 或可复制文字的 PDF。', 'input', '#course-plan-file'],
  DOCUMENT_TOO_LONG: ['文件内容过长', '请只保留本次学生的课程规划，控制在 5 万字以内，再重新上传。', 'input', '#course-plan-file'],
  INVALID_DOCUMENT: ['文件可能损坏、加密或尚未保存完整', '请在电脑上打开文件，另存为 DOCX、XLSX 或非加密 PDF，再重新上传。', 'input', '#course-plan-file'],
  COURSE_PLAN_PARSE_FAILED: ['系统本次没有完成课程规划解析', '请点击“重新解析”；若仍失败，将课程规划另存为 Word 或 Excel 后重新上传，试听反馈无需重填。', 'service'],
  REPORT_NOT_FOUND: ['这份历史报告不存在，或不属于当前账号', '请返回历史报告列表刷新；若报告仍不见，请联系管理员。', 'history'],
  REPORT_LIST_FAILED: ['暂时无法读取历史报告列表', '请点击“重试读取”；这不表示历史报告已丢失。', 'history'],
  REPORT_READ_FAILED: ['暂时无法打开这份历史报告', '请点击“重试打开”；不要重复新建同一份报告。', 'history'],
  REPORT_SAVE_FAILED: ['报告暂时未能保存', '请保留当前页面，点击“重新保存”；不要重新生成，也不要直接关闭页面。', 'save'],
  LOCAL_STORAGE_UNAVAILABLE: ['浏览器暂时无法保存本地草稿', '请保留当前页面，并复制课堂记录备份；报告生成后及时保存到历史报告。', 'service'],
  REPORT_RENDER_FAILED: ['报告已生成，但页面暂时无法展示', '请先保存报告，再点击“重新加载报告”；也可在保存成功后从历史报告重新打开，无需重新生成。', 'render'],
  QUICK_PREVIEW_FAILED: ['报告样式预览暂时无法打开', '请重试样式预览；这一步还没有生成正式报告，无需重新填写内容。', 'preview'],
  EXPORT_IMAGES_FAILED: ['报告中的部分图片尚未加载成功', '请检查网络后重试导出；若仍失败，保存后从历史报告重新打开，再导出 PDF，无需重新生成。', 'export'],
  EXPORT_FAILED: ['本次未能打开打印窗口', '请允许浏览器打开打印窗口，再点击“导出 PDF”；也可在报告预览中使用浏览器的打印功能。', 'export'],
  COPY_FAILED: ['浏览器未允许自动复制', '请直接选中话术文字，按 Ctrl+C（Mac 使用 Command+C）复制。', 'copy'],
  TEACHER_PROFILE_LOAD_FAILED: ['暂时无法读取您的老师资料', '请点击“重新读取资料”；在资料恢复前，请勿交付缺少教师介绍的报告。', 'profile'],
};

export function getWorkflowError(error = {}, { operation = 'generate' } = {}) {
  const code = String(error.code || error.message || '').toUpperCase();
  const status = error.status;
  if (status === 401 || code === 'UNAUTHORIZED' || code === 'SESSION_EXPIRED') {
    return { title: '登录已过期', reason: '请保持当前页面打开，暂时不要刷新或关闭。', action: '在新窗口重新登录，然后回到本页重试刚才的操作；无需重新填写。若忘记密码或账号已停用，再联系管理员。', category: 'account', actionId: 'login' };
  }
  let entry = ERRORS[code];
  if (error.generationStage === 'render') entry = ERRORS.REPORT_RENDER_FAILED;
  if (code === 'INVALID_INPUT' || code === 'INVALID_SCORE' || code === 'INVALID_LESSON_COUNT' || code === 'INVALID_PLANNING_FOCUS') {
    const reportedField = error.issues?.find((issue) => INPUT_FIELDS[String(issue.path).split('.')[0]])?.path;
    const field = reportedField || (code === 'INVALID_SCORE' ? 'currentScore' : code === 'INVALID_LESSON_COUNT' ? 'lessonCount' : code === 'INVALID_PLANNING_FOCUS' ? 'planningFocusAreas' : '');
    const spec = INPUT_FIELDS[String(field).split('.')[0]];
    if (spec) return { title: `请检查${spec[0]}`, reason: '这项填写未通过检查。', action: spec[2], category: 'input', focus: spec[1], actionId: 'input' };
    if (error.issues?.length) return { title: '系统未能读取课程生成参数', reason: '本次请求未通过系统检查，不代表您的课堂记录写得不好。', action: '请点击“继续生成”重新提交；不要随意删改正确的课堂记录。', category: 'service', actionId: 'generate' };
    return { title: '填写信息未通过检查', reason: '请先核对学生姓名、科目、课时、课次和试听课反馈。', action: '请点击“检查填写内容”，补齐标出的必填项；试听反馈需 20–6000 字，完成后重新生成。', category: 'input', actionId: 'input', focus: '#student-name' };
  }
  if (code === 'INVALID_REPORT_DATA') {
    const path = String(error.issues?.[0]?.path || '');
    const lesson = path.match(/^coursePlan\.stages\.(\d+)\.lessons\.(\d+)\.([A-Za-z]+)/);
    if (lesson) {
      const field = { duration: ['时长', '请使用 0.5、1、1.5 或 2 小时'], theme: ['课程主题', '请填写课程主题，最多 120 字'], content: ['授课内容', '请将授课内容控制在 600 字以内'], difficulty: ['重难点', '请将重难点控制在 180 字以内'], goal: ['教学目标', '请将教学目标控制在 180 字以内'] }[lesson[3]];
      if (field) return { title: '报告尚未保存', reason: `第 ${Number(lesson[1]) + 1} 阶段第 ${Number(lesson[2]) + 1} 课的${field[0]}未通过检查。`, action: `${field[1]}，然后重新保存，无需重新生成。`, category: 'save', actionId: 'edit-plan' };
    }
    const spec = INPUT_FIELDS[path.split('.')[0]];
    if (spec) return { title: `报告尚未保存：请检查${spec[0]}`, reason: '报告仍保留在当前页面。', action: `${spec[2]} 修改后点击“重新保存”，无需重新生成。`, category: 'save', actionId: 'input', focus: spec[1] };
    const area = path.startsWith('coursePlan') ? '课程规划' : path.startsWith('salesFollowUp') ? '跟进话术' : '试听总结';
    return { title: '报告尚未保存', reason: `${area}中有内容未通过保存检查。`, action: `请检查${area}是否有空白必填项或过长内容，修改后重新保存；若内容完整，请联系管理员，不要重新生成。`, category: 'save', actionId: area === '课程规划' ? 'edit-plan' : area === '试听总结' ? 'edit-summary' : '' };
  }
  if (!entry) entry = status === 403 ? ERRORS.FORBIDDEN : status === 429
    ? ['当前使用人数较多', '请稍等 1 分钟后重试，不需要修改课堂记录。', 'service']
    : operation === 'save' ? ERRORS.REPORT_SAVE_FAILED : operation === 'upload' ? ERRORS.COURSE_PLAN_PARSE_FAILED
    : operation === 'history' ? ERRORS.REPORT_READ_FAILED : operation === 'export' ? ERRORS.EXPORT_FAILED : operation === 'profile' ? ERRORS.TEACHER_PROFILE_LOAD_FAILED
    : ['系统本次没有完成操作', '请保持当前页面打开，等待 1 分钟后重试，不需要修改课堂记录。若多次重试仍失败，再提供问题编号寻求帮助。', 'service'];
  const [reason, action, category, focus] = entry;
  const title = category === 'render' ? '报告已生成，暂时无法展示' : operation === 'save' ? '报告尚未保存' : operation === 'upload' ? '文件尚未解析完成' : operation === 'export' ? '暂时无法导出 PDF' : operation === 'history' ? '历史报告暂时无法读取' : operation === 'copy' ? '暂时无法自动复制' : operation === 'profile' ? '老师资料暂时无法读取' : operation === 'preview' ? '样式预览暂时无法打开' : '本次生成未完成';
  const preserve = operation === 'save' ? ' 报告仍在本页，请不要关闭页面；恢复后重新保存，无需重新生成。' : '';
  const actionId = category === 'account' || code.endsWith('NOT_CONFIGURED') ? '' : category === 'preview' ? 'quick-preview' : category === 'render' ? 'save' : category === 'input' ? 'input' : operation === 'save' ? 'save' : operation === 'upload' ? 'upload' : operation === 'history' ? 'history' : operation === 'export' ? 'export' : operation === 'profile' ? 'profile' : operation === 'copy' ? '' : 'generate';
  return { title, reason, action: action + preserve, category, focus, actionId };
}
