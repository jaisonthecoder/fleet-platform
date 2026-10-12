import { BadRequestException } from '@nestjs/common';

import { FileValidationService, type UploadCandidate } from './file-validation.service';

const PDF = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]);

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function candidate(overrides: Partial<UploadCandidate> = {}): UploadCandidate {
  return {
    originalname: 'packing-list.pdf',
    mimetype: 'application/pdf',
    size: PDF.length,
    buffer: PDF,
    ...overrides,
  };
}

/**
 * This service is the boundary between what a customer sends and what a member of
 * staff later opens on their own machine. Everything here is about refusing, so
 * the tests are mostly about what does NOT get through.
 */
describe('FileValidationService', () => {
  const service = new FileValidationService();
  const oneMb = 1024 * 1024;

  describe('what it accepts', () => {
    it('accepts a PDF whose bytes agree with its type', () => {
      const result = service.validate(candidate(), oneMb);

      expect(result.contentType).toBe('application/pdf');
      expect(result.extension).toBe('pdf');
      expect(result.sizeBytes).toBe(PDF.length);
    });

    it.each([
      ['image/png', PNG, 'png'],
      ['image/jpeg', JPEG, 'jpg'],
      [XLSX, ZIP, 'xlsx'],
    ])('accepts %s', (mimetype, buffer, extension) => {
      const result = service.validate(candidate({ mimetype, buffer, size: buffer.length }), oneMb);

      expect(result.extension).toBe(extension);
    });

    it('ignores a charset on the declared type', () => {
      // Browsers append one; refusing over it would be refusing valid uploads.
      expect(() =>
        service.validate(candidate({ mimetype: 'application/pdf; charset=binary' }), oneMb),
      ).not.toThrow();
    });
  });

  describe('what it refuses', () => {
    it('refuses an empty file', () => {
      expect(() => service.validate(candidate({ buffer: Buffer.alloc(0) }), oneMb))
        .toThrow(BadRequestException);
    });

    it('refuses a file over the ceiling', () => {
      const big = Buffer.concat([PDF, Buffer.alloc(200)]);

      expect(() => service.validate(candidate({ buffer: big }), 100)).toThrow(BadRequestException);
    });

    it.each(['text/html', 'application/x-msdownload', 'image/svg+xml', 'application/zip', ''])(
      'refuses the type %s outright',
      (mimetype) => {
        expect(() => service.validate(candidate({ mimetype }), oneMb)).toThrow(BadRequestException);
      },
    );

    /**
     * The defect this exists to stop: a browser's Content-Type is a claim. An
     * executable announcing itself as a PDF must not reach a pricer's desktop.
     */
    it('refuses content that contradicts the declared type', () => {
      const executable = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);

      expect(() =>
        service.validate(candidate({ mimetype: 'application/pdf', buffer: executable }), oneMb),
      ).toThrow(BadRequestException);
    });

    it('refuses a file too short to carry a signature', () => {
      expect(() => service.validate(candidate({ buffer: Buffer.from([0x25]) }), oneMb))
        .toThrow(BadRequestException);
    });

    it('names the reason in the error details', () => {
      try {
        service.validate(candidate({ mimetype: 'text/html' }), oneMb);
        throw new Error('expected a refusal');
      } catch (error) {
        expect((error as BadRequestException).getResponse()).toMatchObject({
          details: { code: 'FILE_TYPE_NOT_ALLOWED' },
        });
      }
    });
  });

  describe('the display name', () => {
    it('strips directory separators so a name can never be a path', () => {
      const result = service.validate(
        candidate({ originalname: '../../etc/passwd.pdf' }),
        oneMb,
      );

      expect(result.originalFilename).not.toContain('/');
      expect(result.originalFilename).not.toContain('\\');
    });

    it('strips control characters, which would forge a response header', () => {
      // The name goes into Content-Disposition; a newline there lets a caller
      // write headers of their own.
      const result = service.validate(
        candidate({ originalname: 'inv\r\noice"Set-Cookie: x.pdf' }),
        oneMb,
      );

      expect(result.originalFilename).not.toMatch(/[\r\n"]/);
    });

    it('falls back when the name is unusable', () => {
      expect(service.validate(candidate({ originalname: '   ' }), oneMb).originalFilename)
        .toBe('attachment.pdf');
    });

    it('caps an absurdly long name', () => {
      const long = `${'a'.repeat(500)}.pdf`;

      expect(service.validate(candidate({ originalname: long }), oneMb).originalFilename.length)
        .toBeLessThanOrEqual(200);
    });
  });

  describe('the generated object name', () => {
    const group = '11111111-1111-4111-8111-111111111111';
    const quote = '22222222-2222-4222-8222-222222222222';

    it('is grouped by tenant and owner', () => {
      expect(service.blobNameFor(group, quote, 'pdf')).toMatch(
        new RegExp(`^${group}/${quote}/[0-9a-f-]{36}\\.pdf$`),
      );
    });

    it('never repeats, so two uploads of one filename cannot collide', () => {
      const first = service.blobNameFor(group, quote, 'pdf');
      const second = service.blobNameFor(group, quote, 'pdf');

      expect(first).not.toBe(second);
    });

    it('contains nothing the customer supplied', () => {
      // The customer's filename is not in the path at all. That is what makes
      // traversal and overwriting impossible rather than merely unlikely.
      const name = service.blobNameFor(group, quote, 'pdf');

      expect(name).not.toContain('packing-list');
    });
  });
});
