import type { PlatformRole } from '../../../common/database/schema';
import { costVisibility, maskFinesTile } from './cost-masking';

const rows = [
  { personId: 'p1', fineCount: 2, totalAmount: '500.00' },
  { personId: 'p2', fineCount: 1, totalAmount: '150.00' },
];
const data = { totalFines: 3, totalAmount: '650.00', perUser: rows };

describe('cost-masking', () => {
  describe('costVisibility', () => {
    it('gives Finance full visibility', () => {
      expect(costVisibility(['Finance'] as PlatformRole[])).toBe('full');
    });
    it('gives Executive aggregate-only visibility', () => {
      expect(costVisibility(['Executive'] as PlatformRole[])).toBe('aggregate');
    });
    it('masks cost for every other role', () => {
      expect(costVisibility(['FleetManager'] as PlatformRole[])).toBe('masked');
      expect(costVisibility([] as PlatformRole[])).toBe('masked');
    });
    it('prefers Finance when both Finance and Executive are held', () => {
      expect(costVisibility(['Executive', 'Finance'] as PlatformRole[])).toBe('full');
    });
  });

  describe('maskFinesTile', () => {
    it('full → grand total + per-user breakdown', () => {
      const tile = maskFinesTile('full', data);
      expect(tile.totalAmount).toBe('650.00');
      expect(tile.perUser).toHaveLength(2);
    });
    it('aggregate → grand total, no per-user rows', () => {
      const tile = maskFinesTile('aggregate', data);
      expect(tile.totalAmount).toBe('650.00');
      expect(tile.perUser).toHaveLength(0);
    });
    it('masked → counts only, no monetary amounts', () => {
      const tile = maskFinesTile('masked', data);
      expect(tile.totalFines).toBe(3);
      expect(tile.totalAmount).toBeNull();
      expect(tile.perUser).toHaveLength(0);
    });
  });
});
