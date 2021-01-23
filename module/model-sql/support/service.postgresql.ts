let valid = false;
try {
  require('pg');
  valid = true;
} catch {
}
const version = '12.2';

export const service = valid ? {
  name: 'postgresql',
  version,
  port: 5432,
  image: `postgres:${version}-alpine`,
  env: {
    POSTGRES_USER: 'root',
    POSTGRES_PASSWORD: 'password',
    POSTGRES_DB: 'app'
  }
} : undefined;