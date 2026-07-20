-- Enabled on first container start for local development. Mirrors the Azure
-- PostgreSQL Flexible Server azure.extensions allowlist (timescaledb + pgcrypto).
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
