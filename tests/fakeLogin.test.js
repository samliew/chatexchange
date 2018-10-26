import request from 'request-promise-native';
import Client from '../src/Client';

jest.mock('request-promise-native', function() {
    const fs = require('fs');
    const fn = jest.fn(async (options) => {
        switch (options.uri) {
            case 'https://stackoverflow.com/users/login':
                return {
                    body: fs.readFileSync('./tests/mocks/login.html').toString('utf-8'),
                };
            case 'https://chat.stackoverflow.com/chats/join/favorite':
                return {
                    body: fs.readFileSync('./tests/mocks/profile.html').toString('utf-8'),
                };
        }

        throw new Error(`The url ${options.uri} should not have been called.`);
    });

    fn.defaults = () => fn;
    fn.jar = () => ({
        getCookies: () => [{
            key: 'acct',
            value: 'sample-acct-cookie'
        }]
    });

    return fn;
});

describe('Login', () => {
    test('Verify User Information Found', async () => {
        expect.assertions(3);
        const client = new Client('stackoverflow.com');

        await client.login('test@test.com', 'testpassword');

        expect(await client._browser.chatFKey).toEqual('abc3a168fb58f83bb158d796b2d21c79');
        expect(await client._browser.userName).toEqual('spotdetector');
        expect(await client._browser.userId).toEqual(10162108);
    });
});