import request from 'request-promise-native';
import Client from '../../src/Client';


describe('Real Site Login', () => {
    if (!process.env.SE2_EMAIL || !process.env.SE_PASSWORD) {
        console.log('Not running login test as no credentials supplied via environment (SE_EMAIL and SE_PASSWORD).');
        test.skip('Should login with credentials', () => {});
        return;
    }

    test('Should login with credentials', async () => {
        expect.assertions(2);
        const client = new Client('stackoverflow.com');

        const cookie = await client.login(process.env.SE_EMAIL, process.env.SE_PASSWORD);

        const user = await client.getMe();
        expect(user.id).toBeTruthy();

        // Login with a new client, via cookie
        const client2 = new Client('stackoverflow.com');

        await client2.loginCookie(cookie);

        const user2 = await client2.getMe();
        expect(user2.id).toEqual(user.id);
    });
});
