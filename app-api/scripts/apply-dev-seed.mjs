#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';

const nodeEnv = process.env.NODE_ENV ?? 'local';
if (!['local', 'development', 'test'].includes(nodeEnv)) {
  throw new Error(`refusing development seed in NODE_ENV=${nodeEnv}`);
}

const databaseUrl = process.env.DATABASE_URL ?? 'postgres://fleet:fleet@localhost:5442/fleet';
const seed = await readFile(new URL('./seed-dev.sql', import.meta.url), 'utf8');
const sql = postgres(databaseUrl, { max: 1, prepare: false });
try {
  await sql.unsafe(seed);
  console.log('Development hierarchy, people, roles and reference values are current.');
} finally {
  await sql.end({ timeout: 5 });
}
