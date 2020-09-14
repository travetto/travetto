try {
  require('@aws-sdk/client-dynamodb');
} catch {
  return module.exports = undefined;
}

const version = '1.13.3';

module.exports = {
  name: 'dynamodb',
  version,
  port: 8000,
  image: `amazon/dynamodb-local:${version}`
};