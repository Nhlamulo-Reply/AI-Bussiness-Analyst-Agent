import { describe, expect, it } from "vitest";
import {
  documentMetadataSchema,
  formatFileSize,
  getDocumentFileValidationError,
  getDocumentTypeLabel,
} from "./document.schemas";

const document = {
  id: "document-1",
  projectId: "project-1",
  uploadedByUserId: "user-1",
  fileName: "brief.txt",
  mimeType: "text/plain",
  sizeBytes: 5,
  status: "uploaded",
  createdAt: "2026-03-04T05:06:07.000Z",
};

describe("document metadata and upload validation", () => {
  it("accepts supported files up to the exact 5 MiB limit", () => {
    expect(
      getDocumentFileValidationError({
        name: "brief.PDF",
        size: 5 * 1024 * 1024,
        type: "application/pdf",
      }),
    ).toBeUndefined();
  });

  it("rejects empty, oversized, unsupported, and mismatched files", () => {
    expect(
      getDocumentFileValidationError({
        name: "empty.txt",
        size: 0,
        type: "text/plain",
      }),
    ).toMatch(/empty/i);
    expect(
      getDocumentFileValidationError({
        name: "large.txt",
        size: 5 * 1024 * 1024 + 1,
        type: "text/plain",
      }),
    ).toMatch(/5 MiB/i);
    expect(
      getDocumentFileValidationError({
        name: "brief.rtf",
        size: 20,
        type: "application/rtf",
      }),
    ).toMatch(/PDF, DOCX, or plain-text TXT/i);
    expect(
      getDocumentFileValidationError({
        name: "brief.pdf",
        size: 20,
        type: "text/plain",
      }),
    ).toMatch(/do not match/i);
  });

  it("validates metadata without allowing document bytes in API responses", () => {
    expect(documentMetadataSchema.parse(document)).toEqual(document);
    expect(
      documentMetadataSchema.safeParse({
        ...document,
        contentBase64: "must-not-be-returned",
      }).success,
    ).toBe(false);
  });

  it("formats file metadata for the library", () => {
    expect(getDocumentTypeLabel("application/pdf")).toBe("PDF");
    expect(formatFileSize(1024)).toBe("1 KB");
  });
});
