function endAsSentence(value) {
  const trimmed = value.trim().replace(/[，,；;、：:]+$/u, '');
  return /[。！？!?]$/u.test(trimmed) ? trimmed : `${trimmed}。`;
}

export function compactCompleteText(value, maxLength) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized || normalized.length <= maxLength) return normalized;

  const clauses = normalized.match(/[^。！？!?；;]+[。！？!?；;]?/gu) || [];
  let result = '';
  for (const clause of clauses) {
    const candidate = `${result}${clause}`;
    if (candidate.length > maxLength) break;
    result = candidate;
  }

  if (result) return endAsSentence(result);

  const candidate = normalized.slice(0, maxLength);
  const boundary = Math.max(
    candidate.lastIndexOf('，'),
    candidate.lastIndexOf(','),
    candidate.lastIndexOf('、'),
  );
  const fallback = boundary >= Math.floor(maxLength * 0.25)
    ? candidate.slice(0, boundary)
    : candidate;
  return endAsSentence(fallback);
}
