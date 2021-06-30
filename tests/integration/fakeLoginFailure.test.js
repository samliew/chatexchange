import InternalError from '../../src/Exceptions/InternalError';
import Client from '../../src/Client';

jest.mock('request-promise-native', function() {
    const fs = require('fs');
    const fn = jest.fn(async (options) => {
        switch (options.uri) {
            case 'https://stackoverflow.com/users/login':
                return {
                    statusCode: 200,
                    body: fs.readFileSync('./tests/mocks/login_nofkey.html').toString('utf-8'),
                };
        }

        throw new Error(`The url ${options.uri} should not have been called.`);
    });

    fn.defaults = () => fn;
    fn.jar = () => ({
        getCookies: () => []
    });

    return fn;
});

describe('Login Failure', () => {

    it('Should reject with InternalError when no fkey found', async () => {
        
        expect.assertions(1);
        const client = new Client('stackoverflow.com');

        await expect(client.login('test@test.com', 'P@ssw0rd')).rejects.toThrowError(InternalError);
    });
})
