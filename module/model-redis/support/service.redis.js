const version = 5;

module.exports = {
  name: 'redis',
  version,
  port: 6379,
  image: `redis:${version}-alpine`
};