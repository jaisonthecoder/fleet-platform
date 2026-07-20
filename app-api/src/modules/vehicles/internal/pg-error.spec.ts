import { BadRequestException, ConflictException } from '@nestjs/common';
import { toDbException } from './pg-error';

/** Mimics a drizzle-wrapped postgres error (code lives on `.cause`). */
const wrapped = (code: string, constraint: string) => ({
  name: 'DrizzleQueryError',
  message: 'query failed',
  cause: { code, constraint_name: constraint },
});

describe('toDbException', () => {
  it('maps a unique violation (23505) to Conflict', () => {
    const e = toDbException(wrapped('23505', 'vehicle_plate_uq'));
    expect(e).toBeInstanceOf(ConflictException);
    expect((e as ConflictException).getResponse()).toMatchObject({
      reasons: ['unique-violation:vehicle_plate_uq'],
    });
  });

  it('maps an exclusion violation (23P01) to Conflict', () => {
    expect(toDbException(wrapped('23P01', 'vehicle_hierarchy_assignment_no_overlap'))).toBeInstanceOf(
      ConflictException,
    );
  });

  it('maps a foreign-key violation (23503) to BadRequest', () => {
    const e = toDbException(wrapped('23503', 'vehicle_assigned_driver_person_id_fk'));
    expect(e).toBeInstanceOf(BadRequestException);
    expect((e as BadRequestException).getResponse()).toMatchObject({
      reasons: ['fk-violation:vehicle_assigned_driver_person_id_fk'],
    });
  });

  it('maps a check violation (23514) to BadRequest', () => {
    expect(toDbException(wrapped('23514', 'some_check'))).toBeInstanceOf(BadRequestException);
  });

  it('passes an unrecognised error through unchanged', () => {
    const original = new Error('boom');
    expect(toDbException(original)).toBe(original);
  });
});
