// Re-exported from the shared DB error mapper so bookings maps Postgres
// constraint violations (23P01 exclusion → 409, 23505 unique → 409, 23503 FK →
// 400) identically to vehicles and telematics.
export { toDbException } from '../../../common/database/pg-error';
