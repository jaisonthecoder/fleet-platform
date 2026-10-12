const connection = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid');

if (
  process.env.NODE_ENV !== 'test' ||
  !/^\/noatum_test_[a-f0-9]{32}$/.test(connection.pathname) ||
  !['localhost', '127.0.0.1'].includes(connection.hostname) ||
  connection.username !== 'portal_app'
) {
  throw new Error('Database tests require a disposable local database and portal_app. Run pnpm test:db.');
}
