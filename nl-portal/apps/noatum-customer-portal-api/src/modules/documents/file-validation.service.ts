import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

/**
 * What the portal will accept, and what it refuses.
 *
 * Keyed on the type we are willing to store, with the byte signature that proves
 * it. A browser's `Content-Type` is a claim; these first bytes are the evidence.
 *
 * Extensions are for display and for the download filename only. Nothing routes
 * on them.
 */
const ACCEPTED = {
  'application/pdf': { extension: 'pdf', signatures: [[0x25, 0x50, 0x44, 0x46]] },
  'image/png': { extension: 'png', signatures: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]] },
  'image/jpeg': { extension: 'jpg', signatures: [[0xff, 0xd8, 0xff]] },
  // Office formats are ZIP archives, so they share one signature and cannot be
  // told apart by their first bytes. Accepting the pair means trusting the
  // declared type to choose BETWEEN them - never to get past the allow-list.
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    extension: 'xlsx',
    signatures: [[0x50, 0x4b, 0x03, 0x04], [0x50, 0x4b, 0x05, 0x06]],
  },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    extension: 'docx',
    signatures: [[0x50, 0x4b, 0x03, 0x04], [0x50, 0x4b, 0x05, 0x06]],
  },
} as const satisfies Record<string, { extension: string; signatures: readonly (readonly number[])[] }>;

export type AcceptedContentType = keyof typeof ACCEPTED;

export const ACCEPTED_CONTENT_TYPES = Object.keys(ACCEPTED) as AcceptedContentType[];

export interface ValidatedUpload {
  contentType: AcceptedContentType;
  extension: string;
  originalFilename: string;
  sizeBytes: number;
}

export interface UploadCandidate {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class FileValidationService {
  /**
   * Refuses anything we are not prepared to hand to a person later.
   *
   * Order matters. Size is checked before the bytes are examined so a large file
   * is rejected on its declared length rather than after being read, and the
   * signature is checked last because it is the only test that needs the content.
   */
  validate(file: UploadCandidate, maxSizeBytes: number): ValidatedUpload {
    if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
      throw new BadRequestException({
        message: 'That file is empty.',
        details: { code: 'FILE_EMPTY' },
      });
    }

    if (file.buffer.length > maxSizeBytes) {
      throw new BadRequestException({
        message: `That file is larger than the ${Math.floor(maxSizeBytes / (1024 * 1024))} MB limit.`,
        details: { code: 'FILE_TOO_LARGE', maxSizeBytes, sizeBytes: file.buffer.length },
      });
    }

    const declared = (file.mimetype ?? '').split(';')[0]?.trim().toLowerCase() ?? '';

    if (!isAccepted(declared)) {
      throw new BadRequestException({
        message: 'That file type cannot be attached.',
        details: { code: 'FILE_TYPE_NOT_ALLOWED', accepted: ACCEPTED_CONTENT_TYPES },
      });
    }

    const entry = ACCEPTED[declared];

    // The claim has to match the bytes. A PDF renamed to .xlsx, or a script
    // announcing itself as an image, stops here rather than in someone's viewer.
    if (!entry.signatures.some((signature) => startsWith(file.buffer, signature))) {
      throw new BadRequestException({
        message: 'That file does not look like the type it claims to be.',
        details: { code: 'FILE_CONTENT_MISMATCH', declared },
      });
    }

    return {
      contentType: declared,
      extension: entry.extension,
      originalFilename: safeDisplayName(file.originalname, entry.extension),
      sizeBytes: file.buffer.length,
    };
  }

  /**
   * The object name, generated here and nowhere else.
   *
   * Grouped by tenant and owner so a container can be read by a human, and ending
   * in a UUID so two uploads of the same filename never collide. The customer's
   * filename is not in the path at all - that is what makes traversal and
   * overwriting impossible rather than merely unlikely.
   */
  blobNameFor(customerGroupId: string, ownerId: string, extension: string): string {
    return `${customerGroupId}/${ownerId}/${randomUUID()}.${extension}`;
  }
}

function isAccepted(value: string): value is AcceptedContentType {
  return Object.hasOwn(ACCEPTED, value);
}

function startsWith(buffer: Buffer, signature: readonly number[]): boolean {
  if (buffer.length < signature.length) return false;
  return signature.every((byte, index) => buffer[index] === byte);
}

/**
 * The name shown back to the customer.
 *
 * Stripped of directory separators and control characters because it is rendered
 * in a list and sent in a `Content-Disposition` header, where a newline would let
 * a caller write their own headers.
 */
function safeDisplayName(original: string, extension: string): string {
  const base = (original ?? '')
    .replace(/[\\/]/g, '_')
    .replace(/[\u0000-\u001f\u007f"]/g, '')
    .trim();

  if (base === '') return `attachment.${extension}`;
  return base.slice(0, 200);
}
