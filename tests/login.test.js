import assert from 'assert';
import Client from '../dist/Client';

// console.log(process.env);


describe('Login', function() {
    test('Should login with credentials', async function() {
        if (!process.env.SE_EMAIL || !process.env.SE_PASSWORD) {
            console.log('Not running login test as no credentials supplied via environment (SE_EMAIL and SE_PASSWORD).');
            return;
        }

        expect.assertions(1);
        const client = new Client('stackoverflow.com');

        await client.login(process.env.SE_EMAIL, process.env.SE_PASSWORD);

        const user = await client.getMe();
        expect(user.id).toBeTruthy();
    });
});