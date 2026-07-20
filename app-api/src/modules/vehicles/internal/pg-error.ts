// Re-exported from the shared DB error mapper so both vehicles and telematics
// (and future modules) map Postgres constraint violations identically.
export { toDbException } from '../../../common/database/pg-error';
