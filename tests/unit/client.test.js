import request from 'request-promise-native';
import Client from '../../src/Client';
import InvalidArgumentError from '../../src/Exceptions/InvalidArgumentError';
import ChatExchangeError from '../../src/Exceptions/ChatExchangeError';
import User from '../../src/User';

describe('Client', () => {
    test('Should throw invalid host', async () => {
        expect.assertions(2);

        expect(() => new Client()).toThrowError(InvalidArgumentError);
        expect(() => new Client('asdf')).toThrowError(InvalidArgumentError);
    });

    test('Should throw error if not logged in', async () => {
        expect.assertions(1);

        await expect(new Client('stackoverflow.com').getMe())
            .rejects.toThrowError(ChatExchangeError);
    });

    test('Should return logged in user', async () => {
        expect.assertions(2);

        const client = new Client('stackoverflow.com');

        client._browser = {
            loggedIn: true,
            userId: Promise.resolve(5)
        };

        const user = await client.getMe();

        expect(user).toBeInstanceOf(User);
        expect(user.id).toEqual(5);

    });

    test('Should throw error if invalid email/password', async () => {
        expect.assertions(2);

        await expect(new Client('stackoverflow.com').login())
            .rejects.toThrowError(InvalidArgumentError);
        
        await expect(new Client('stackoverflow.com').login('test@test.com'))
            .rejects.toThrowError(InvalidArgumentError);
    });

    test('Should throw error if invalid cookieString', async () => {
        expect.assertions(2);
        
        await expect(new Client('stackoverflow.com').loginCookie())
            .rejects.toThrowError(InvalidArgumentError);

        await expect(new Client('stackoverflow.com').loginCookie(''))
            .rejects.toThrowError(InvalidArgumentError);
    });

    test('Should attempt to login with a cookieString', async () => {
        expect.assertions(2);

        const loginCookieMock = jest.fn();

        const browserMock = {
            loginCookie: loginCookieMock,
        };

        const client = new Client('stackoverflow.com');

        client._browser = browserMock;

        const cookieStr = 'testing';

        await client.loginCookie(cookieStr);

        expect(loginCookieMock).toHaveBeenCalledTimes(1);
        expect(loginCookieMock).toHaveBeenLastCalledWith(cookieStr);
    });

    it('Should attempt to join a room', async () => {
        expect.assertions(1);

        var client = new Client('stackoverflow.com');

        client._browser = {
            joinRoom: jest.fn()
        }

        await client.joinRoom(5);

        expect(client._browser.joinRoom).toHaveBeenCalledWith(5);
    });
});
