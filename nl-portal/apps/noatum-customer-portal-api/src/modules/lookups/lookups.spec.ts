import { canEditContent, canRetire } from './lookups.service';
import { LOOKUP_OWNERSHIPS } from '../../contracts/dto/lookup.dto';

/**
 * Two different questions, deliberately answered differently: who owns the wording of a
 * code, and who decides whether Noatum uses it at all.
 */
describe('lookup ownership rules', () => {
  describe('content editing', () => {
    it('is allowed only on portal-owned lists', () => {
      expect(canEditContent('portal')).toBe(true);
      expect(canEditContent('source')).toBe(false);
      expect(canEditContent('system')).toBe(false);
    });
  });

  describe('retirement', () => {
    it('is allowed on a portal list', () => {
      expect(canRetire('portal')).toBe(true);
    });

    it('is allowed on a source list, because using a code is our decision', () => {
      // CargoWise owns what a document type is called; it does not own whether we use it.
      expect(canRetire('source')).toBe(true);
    });

    it('is refused on a system list, because code branches on those values', () => {
      // transport_mode and quote_status mirror Postgres enums the application reads.
      expect(canRetire('system')).toBe(false);
    });
  });

  it('answers both questions for every ownership the contract allows', () => {
    for (const ownership of LOOKUP_OWNERSHIPS) {
      expect(typeof canEditContent(ownership)).toBe('boolean');
      expect(typeof canRetire(ownership)).toBe('boolean');
    }
  });

  it('never allows content editing where retirement is refused', () => {
    // A locked list must not be editable by a wider rule than the one that locks it.
    for (const ownership of LOOKUP_OWNERSHIPS) {
      if (!canRetire(ownership)) expect(canEditContent(ownership)).toBe(false);
    }
  });
});
