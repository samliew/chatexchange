import Client from '../../src/Client';
import ChatExchangeError from '../../src/Exceptions/ChatExchangeError';

jest.mock('got', () => {
    const fn = jest.fn(async (url) => {
        switch (url) {
            case 'https://stackoverflow.com/users/login':
                return {
                    statusCode: 500,
                    body: 'Internal Server Error',
                };
        }
    });

    return Object.assign(fn, { extend: () => fn });
});

describe('Login Failure', () => {

    it('Should reject with ChatExchangeError when server returns invalid 500 response', async () => {

        expect.assertions(1);
        const client = new Client('stackoverflow.com');

        await expect(client.login('test@test.com', 'P@ssw0rd')).rejects.toThrowError(ChatExchangeError);
    });
});
