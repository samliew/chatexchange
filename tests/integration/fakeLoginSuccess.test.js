import Client from '../../src/Client';
import Room from '../../src/Room';

jest.mock('request-promise-native', function() {
    const fs = require('fs');
    const fn = jest.fn(async (options) => {
        switch (options.uri) {
            case 'https://stackoverflow.com/users/login':
                return {
                    statusCode: 200,
                    body: fs.readFileSync('./tests/mocks/login.html').toString('utf-8'),
                };
            case 'https://chat.stackoverflow.com/chats/join/favorite':
                return {
                    statusCode: 200,
                    body: fs.readFileSync('./tests/mocks/favorite.html').toString('utf-8'),
                };
            case 'https://chat.stackoverflow.com/chats/5/events':
                return {
                    statusCode: 200,
                    body: {
                        time: 1234
                    }
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

    test('Verify attempts to join room', async () => {
        expect.assertions(2);
        const client = new Client('stackoverflow.com');

        await client.login('test@test.com', 'testpassword');
        await client.joinRoom(5);

        const room5 = client._rooms.get(5);

        expect(room5).not.toBeUndefined();
        expect(room5.id).toEqual(5);
    });

    // For testing branches (Promise being called for userId/UserName)
    // these are required
    test('Verify Username Found', async () => {
        const client = new Client('stackoverflow.com');

        await client.login('test@test.com', 'testpassword');
        expect(await client._browser.userName).toEqual('spotdetector');
    });

    test('Verify UserId Found', async () => {
        const client = new Client('stackoverflow.com');

        await client.login('test@test.com', 'testpassword');
        expect(await client._browser.userId).toEqual(10162108);
    });
});
