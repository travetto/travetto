import { registerNamespace } from '../init';
export default registerNamespace('express', {
	serve: true,
	port: 3000,
	context: 'namespace',
	session: {
		secret: 'random key',
		cookie: {
			secure: false,
			secureProxy: false
		}
	}
});
