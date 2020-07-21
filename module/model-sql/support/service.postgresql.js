try {
  require('pg');
} catch {
  return module.exports = undefined;
}

const version = '12.2';

module.exports = {
  name: 'postgresql',
  version,
  port: 5432,
  image: `postgres:${version}-alpine`,
  env: {
    POSTGRES_USER: 'root',
    POSTGRES_PASSWORD: 'password',
    POSTGRES_DB: 'app'
  }
};