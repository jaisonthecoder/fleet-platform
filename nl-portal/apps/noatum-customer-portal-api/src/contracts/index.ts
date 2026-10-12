/**
 * The API's own contracts: DTOs, zod schemas, permission codes, enums, and the small
 * amount of domain logic the server owns.
 *
 * These are deliberately NOT shared with apps/noatum-customer-portal-ui. The two apps share no code —
 * the web client is generated from this API's OpenAPI document, so the contract travels
 * as a spec rather than as an import. Anything the browser needs to know must therefore
 * be expressed in an endpoint or in the OpenAPI schema, not assumed.
 *
 * Rules for this folder:
 *  - no framework imports, so these stay usable from jobs and tests as well as HTTP;
 *  - a shape is declared once here and referenced everywhere else in the API;
 *  - if the browser needs the same rule, expose it as an endpoint rather than copying it.
 */

export * from './chargeable-weight';
export * from './customer.status';
export * from './enums';
export * from './feature-flags';
export * from './feature-switches';
export * from './permissions';
export * from './settings';

export * from './schemas/address-book.schema';
export * from './schemas/quote.schema';
export * from './schemas/quote-pricing.schema';

export * from './dto/account.dto';
export * from './dto/dashboard.dto';
export * from './dto/customer.dto';
export * from './dto/customer-quote.dto';
export * from './dto/create-quote.dto';
export * from './dto/dangerous-goods.dto';
export * from './dto/quote-equipment.dto';
export * from './dto/quote-listing.dto';
export * from './dto/quote-insights.dto';
export * from './dto/special-handling.dto';
export * from './dto/organisation.dto';
export * from './dto/pricing.dto';
export * from './dto/port.dto';
export * from './dto/reference.dto';
export * from './dto/setting.dto';
export * from './dto/tenancy.dto';
export * from './dto/user.dto';
