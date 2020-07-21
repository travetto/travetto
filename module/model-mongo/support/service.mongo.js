const version = '3.6';

module.exports = {
  name: 'mongodb',
  version,
  port: 27017,
  image: `mongo:${version}`
};