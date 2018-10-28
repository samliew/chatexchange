import request from 'request-promise-native';
import ChatExchangeError from '../../src/Exceptions/ChatExchangeError';
import LoginError from '../../src/Exceptions/LoginError';
import InternalError from '../../src/Exceptions/InternalError';
import Client from '../../src/Client';

jest.mock('request-promise-native', function() {
    const fs = require('fs');
    
    const fn = jest.fn(async (options) => {
        switch (options.uri) {
            case 'https://stackoverflow.com/users/login':
                return {
                    body: fs.readFileSync('./tests/mocks/login.html').toString('utf-8'),
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

describe('Login Failures', () => {
    test('Should fail with login error', async () => {
        expect.assertions(1);


        const client = new Client('stackoverflow.com');
    
        await expect(client.login('test@test.com', 'P@ssw0rd')).rejects.toThrowError(LoginError);
    });
});
