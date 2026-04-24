import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export async function extractTextFromFile(file: File): Promise<string> {
  const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isDocx =
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.name.toLowerCase().endsWith('.docx');

  if (!isPDF && !isDocx) {
    throw new Error('Unsupported file type. Please upload a PDF or Word (.docx) file.');
  }

  const arrayBuffer = await file.arrayBuffer();

  if (isPDF) return extractFromPDF(arrayBuffer);
  return extractFromDocx(arrayBuffer);
}

async function extractFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map(item => ('str' in item ? (item as { str: string }).str : ''))
      .join(' ');
    pages.push(text);
  }

  return pages.join('\n\n');
}

async function extractFromDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  // mammoth is CJS; dynamic import lets Vite bundle it correctly for the browser
  const mammoth = await import('mammoth');
  const result = await (mammoth.default ?? mammoth).extractRawText({ arrayBuffer });
  return result.value;
}
