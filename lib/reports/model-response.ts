type ModelResponseLike = {
  output_parsed?: unknown;
  output_text?: string;
};

function extractJsonText(value: string) {
  const normalized = value.trim();
  const fenced = normalized.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : normalized;
}

export function parseModelResponse<T>(
  response: ModelResponseLike,
  validate: (value: unknown) => T | null,
) {
  const parsed = validate(response.output_parsed);
  if (parsed) return parsed;
  if (!response.output_text?.trim()) return null;
  try {
    return validate(JSON.parse(extractJsonText(response.output_text)));
  } catch {
    return null;
  }
}
