let valid = false;
try {
  require('mysql');
  valid = true;
} catch {
}

const version = '5.6';

export const service = valid ? {
  name: 'mysql',
  version,
  image: `mysql:${version}`,
  port: 3306,
  env: {
    MYSQL_ROOT_PASSWORD: 'password',
    MYSQL_DATABASE: 'app'
  },
} : undefined;