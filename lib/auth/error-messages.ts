export function getAccountErrorMessage(error: { code?: string; status?: number; name?: string } | null | undefined, operation: 'login' | 'verify' | 'update') {
  if (error?.code === 'user_banned') return '账号已停用，请联系师资管理人员启用后再登录。';
  if (error?.code === 'invalid_credentials') return operation === 'verify'
    ? '当前密码不正确，请重新输入；如果忘记密码，请联系管理员重置。'
    : '账号或密码不正确，请重新输入；如果忘记密码，请联系管理员重置。';
  if (error?.status === 429 || error?.code === 'over_request_rate_limit') return '操作过于频繁，请等待 1 分钟后再试。';
  if (error?.status === 0 || error?.name === 'AuthRetryableFetchError' || error?.name === 'TypeError') return '暂时无法连接登录服务，请检查网络后重试；不需要因此修改密码。';
  if (['session_not_found', 'refresh_token_not_found', 'refresh_token_already_used'].includes(error?.code || '') || error?.status === 401) return '登录已过期，请先保留未保存内容，再重新登录后操作。';
  return operation === 'update' ? '密码暂时未能修改，请稍后重试；若仍失败，请联系管理员。' : '登录服务暂时不可用，请稍后重试；若仍失败，请联系管理员。';
}
