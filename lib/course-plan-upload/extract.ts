const MAX_EXTRACTED_CHARACTERS = 50000;

export async function extractCoursePlanText(file: File) {
  const extension = file.name.toLowerCase().split('.').pop();
  const buffer = Buffer.from(await file.arrayBuffer());
  let text = '';
  if (extension === 'docx') text = await extractDocx(buffer);
  else if (extension === 'xlsx') text = await extractXlsx(buffer);
  else if (extension === 'pdf') text = await extractPdf(buffer);
  else throw new RangeError('UNSUPPORTED_FILE_TYPE');
  const normalized = text.replace(/\u0000/g, '').replace(/\r\n?/g, '\n').trim();
  if (!normalized) throw new RangeError('EMPTY_DOCUMENT');
  if (normalized.length > MAX_EXTRACTED_CHARACTERS) throw new RangeError('DOCUMENT_TOO_LONG');
  return normalized;
}

async function extractDocx(buffer: Buffer) {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractXlsx(buffer: Buffer) {
  const { default: readXlsxFile } = await import('read-excel-file/node');
  const sheets = await readXlsxFile(buffer);
  const sections = [];
  for (const sheet of sheets) {
    const body = sheet.data.map((row) => row.map((cell) => cell === null ? '' : String(cell)).join('\t')).join('\n');
    if (body.trim()) sections.push(`[工作表：${sheet.sheet}]\n${body}`);
  }
  return sections.join('\n\n');
}

async function extractPdf(buffer: Buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await pdfjs.getDocument({ data: new Uint8Array(buffer), useWorkerFetch: false }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item) => 'str' in item ? item.str : '').join(' ');
    pages.push(`[第 ${pageNumber} 页]\n${text}`);
  }
  return pages.join('\n\n');
}
