try {
  require('mysql');
} catch {
  return module.exports = undefined;
}

const version = '5.6';

module.exports = {
  name: 'mysql',
  version,
  image: `mysql:${version}`,
  port: 3306,
  env: {
    MYSQL_ROOT_PASSWORD: 'password',
    MYSQL_DATABASE: 'app'
  },
};