-- ---------------------------------------------------------------------------
-- A port directory, separate from the lookups
--
-- Origin and destination on the quote request were free-text fields validated by
-- a regex, so a customer had to already know that Valencia is ESVLC. The list
-- they needed did not exist: `catalogue.mjs` records UN/LOCODE as absent on
-- purpose, "licensing and source ownership unresolved". That is now settled -
-- UN/LOCODE is the source - so the directory can exist.
--
-- It is NOT a lookup category, deliberately. `lookup_item` holds lists of five to
-- twenty rows that an administrator curates by hand, and `/api/reference/:category`
-- returns every row of one with no paging. UN/LOCODE is ~100k rows revised twice a
-- year: putting it there would make one dropdown heavier than the rest of the
-- catalogue combined, and would drown the Lookups screen it shares.
--
-- No search engine either. ADR-004 and ADR-008 hold this platform to PostgreSQL
-- alone, re-confirmed 17.09.2026 with code evidence, and a directory this size is
-- not the trigger for reversing that: a prefix index answers an autocomplete in
-- single-digit milliseconds at this row count.
--
-- `text_pattern_ops` rather than a trigram index, because autocomplete is a prefix
-- question - somebody types "Val", not "lenci". pg_trgm would buy infix and fuzzy
-- matching and costs an extension the migration role may not be able to create on a
-- managed instance. Add it the day the business asks to find "Shangai" spelled wrong.
--
-- Nothing references this table by foreign key, and nothing should. A quote keeps
-- the code AND the name it was given, as plain text: UN/LOCODE reassigns and
-- renames entries between editions, and a five-year-old quote must still read the
-- way it was agreed.
-- ---------------------------------------------------------------------------

CREATE TABLE port (
  -- The UN/LOCODE itself: two-letter country, three-letter location.
  code            CHAR(5)      PRIMARY KEY,
  name            VARCHAR(120) NOT NULL,
  -- ISO 3166-1 alpha-2, matching the `country` lookup's codes so the two join.
  country_code    CHAR(2)      NOT NULL,
  -- ISO 3166-2 subdivision where UN/LOCODE records one. Null is ordinary.
  subdivision     VARCHAR(80),

  -- UN/LOCODE's function classifier, split into the two questions this platform
  -- actually asks. A location can be both; Dubai is.
  is_seaport      BOOLEAN      NOT NULL DEFAULT FALSE,
  is_airport      BOOLEAN      NOT NULL DEFAULT FALSE,

  -- Recorded because the route map will want it. Null until an edition supplies it.
  latitude        NUMERIC(8, 5),
  longitude       NUMERIC(8, 5),

  -- Whether Noatum offers this location, which is Noatum's decision and not the
  -- UN's. An import must never flip this back on for a location that was retired.
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,

  -- Provenance, so a row's authority is readable rather than assumed - the same
  -- reason lookup_category carries `source_ref`.
  source          VARCHAR(60)  NOT NULL,

  created_at      TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at      TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT now(),

  CONSTRAINT port_code_format CHECK (code ~ '^[A-Z]{2}[A-Z0-9]{3}$'),
  CONSTRAINT port_country_format CHECK (country_code ~ '^[A-Z]{2}$'),
  -- A location that is neither a seaport nor an airport is not one this platform
  -- can route through, so it has no business being offered.
  CONSTRAINT port_has_a_function CHECK (is_seaport OR is_airport)
);

-- Autocomplete matches on the name a person knows and on the code they may paste.
-- Both are lower-cased, because "valencia" must find "Valencia".
CREATE INDEX port_name_prefix_idx ON port (lower(name) text_pattern_ops);
CREATE INDEX port_code_prefix_idx ON port (lower(code) text_pattern_ops);
-- Narrowing by country is how a customer disambiguates "Santiago".
CREATE INDEX port_country_idx ON port (country_code, lower(name) text_pattern_ops);

-- Reference data, so the same shape as lookup_item: internal sees everything,
-- everyone else sees only what is active. No customer_group_id - a port belongs to
-- no customer, and tenancy here would mean every customer carrying its own copy of
-- Rotterdam.
ALTER TABLE port ENABLE ROW LEVEL SECURITY;
ALTER TABLE port FORCE ROW LEVEL SECURITY;

CREATE POLICY port_read ON port
  FOR SELECT
  USING (
    COALESCE(NULLIF(current_setting('app.is_internal', TRUE), ''), 'false')::BOOLEAN
    OR is_active
  );

CREATE POLICY port_write ON port
  USING (COALESCE(NULLIF(current_setting('app.is_internal', TRUE), ''), 'false')::BOOLEAN)
  WITH CHECK (COALESCE(NULLIF(current_setting('app.is_internal', TRUE), ''), 'false')::BOOLEAN);

GRANT SELECT ON port TO portal_app;
GRANT INSERT, UPDATE, DELETE ON port TO portal_app;

COMMENT ON TABLE port IS
  'UN/LOCODE directory for route autocomplete. Loaded by infra/scripts/seed-ports.mjs, never by a migration: it is reference data on a twice-yearly release cycle, not schema.';
