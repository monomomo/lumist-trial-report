type ModelResponseLike = {
  output_parsed?: unknown;
  output_text?: string;
};

function extractJsonText(value: string) {
  const normalized = value.trim();
  const fenced = normalized.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) return fenced[1].trim();
  const objectStart = normalized.indexOf('{');
  const objectEnd = normalized.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart) return normalized.slice(objectStart, objectEnd + 1);
  return normalized;
}

export function parseModelResponse<T>(
  response: ModelResponseLike,
  validate: (value: unknown) => T | null,
) {
  if (response.output_parsed !== undefined && response.output_parsed !== null) {
    const parsed = validate(response.output_parsed);
    if (parsed) return parsed;
  }
  if (!response.output_text?.trim()) return null;
  try {
    return validate(JSON.parse(extractJsonText(response.output_text)));
  } catch {
    return null;
  }
}
