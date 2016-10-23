import { registerNamespace } from '@encore/init';
export default registerNamespace('express', {
	serve: true,
	port: 3000,
	session: {
		secret: 'random key',
		cookie: {
			secure: false,
			secureProxy: false
		}
	}
});
