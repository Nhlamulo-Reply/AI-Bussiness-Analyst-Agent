import { z } from "zod";

const timestampSchema = z.iso.datetime();
const maxDocumentSizeBytes = 5 * 1024 * 1024;
const mimeTypeByExtension = {
  ".pdf": "application/pdf",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
} as const;

export const documentMimeTypeSchema = z.enum([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

export const documentMetadataSchema = z
  .object({
    id: z.string().min(1),
    projectId: z.string().min(1),
    uploadedByUserId: z.string().min(1),
    fileName: z.string().min(1).max(255),
    mimeType: documentMimeTypeSchema,
    sizeBytes: z.number().int().positive(),
    status: z.literal("uploaded"),
    createdAt: timestampSchema,
  })
  .strict();

export const documentListSchema = z.array(documentMetadataSchema);

export type DocumentMetadata = z.infer<typeof documentMetadataSchema>;
export type DocumentMimeType = z.infer<typeof documentMimeTypeSchema>;

export function getDocumentFileValidationError(
  file: Pick<File, "name" | "size" | "type">,
): string | undefined {
  if (!file.name.trim() || file.name.length > 255) {
    return "The filename must be between 1 and 255 characters.";
  }
  if (file.size === 0) {
    return "This file is empty. Choose a document with content.";
  }
  if (file.size > maxDocumentSizeBytes) {
    return "This file exceeds the 5 MiB limit. Choose a smaller document.";
  }

  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  const expectedMimeType = Object.entries(mimeTypeByExtension).find(
    ([supportedExtension]) => supportedExtension === extension,
  )?.[1];
  if (!expectedMimeType) {
    return "Choose a PDF, DOCX, or plain-text TXT document.";
  }
  if (file.type.toLowerCase() !== expectedMimeType) {
    return "The file extension and file type do not match.";
  }
  return undefined;
}

export function getDocumentTypeLabel(mimeType: DocumentMimeType): string {
  if (mimeType === "application/pdf") return "PDF";
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "DOCX";
  }
  return "TXT";
}

export function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(0)} KB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}
