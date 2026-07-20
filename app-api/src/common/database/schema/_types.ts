import { customType } from 'drizzle-orm/pg-core';

/** PostgreSQL `ltree` type for materialized hierarchy paths (fast roll-up/scope). */
export const ltree = customType<{ data: string }>({
  dataType() {
    return 'ltree';
  },
});
