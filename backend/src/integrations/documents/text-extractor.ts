import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { AppError } from "../../common/errors/app-error";
import type { DocumentRecord } from "../../modules/domain/domain.schemas";

export async function extractDocumentText(document: DocumentRecord): Promise<string> {
  const contents = Buffer.from(document.contentBase64, "base64");
  let text: string;

  try {
    if (document.mimeType === "text/plain") {
      text = new TextDecoder("utf-8", { fatal: true }).decode(contents);
    } else if (document.mimeType === "application/pdf") {
      const parser = new PDFParse({ data: contents });
      try {
        text = (await parser.getText()).text;
      } finally {
        await parser.destroy();
      }
    } else {
      text = (await mammoth.extractRawText({ buffer: contents })).value;
    }
  } catch {
    throw new AppError(422, "DOCUMENT_PARSE_FAILED", "Text could not be extracted from one of the source documents.");
  }

  const normalizedText = text.trim();
  if (!normalizedText) {
    throw new AppError(422, "DOCUMENT_PARSE_FAILED", "A source document contains no extractable text.");
  }
  return normalizedText;
}
