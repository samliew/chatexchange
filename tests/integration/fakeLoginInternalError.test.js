import ChatExchangeError from '../../src/Exceptions/ChatExchangeError';
import Client from '../../src/Client';

jest.mock('request-promise-native', function() {
    const fs = require('fs');
    const fn = jest.fn(async (options) => {
        switch (options.uri) {
            case 'https://stackoverflow.com/users/login':
                return {
                    statusCode: 500,
                    body: 'Internal Server Error',
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

    it('Should reject with ChatExchangeError when server returns invalid 500 response', async () => {
        
        expect.assertions(1);
        const client = new Client('stackoverflow.com');

        await expect(client.login('test@test.com', 'P@ssw0rd')).rejects.toThrowError(ChatExchangeError);
    });
})
