import Browser from "../../src/Browser";
import Client, { Host } from "../../src/Client";
import ChatExchangeError from "../../src/Exceptions/ChatExchangeError";
import InvalidArgumentError from "../../src/Exceptions/InvalidArgumentError";
import Message from "../../src/Message";
import User from "../../src/User";

describe("Client", () => {
    test("Should throw error if invalid host", () => {
        expect.assertions(1);

        //@ts-ignore
        expect(() => new Client("example.com")).toThrowError(InvalidArgumentError);
    })
    test("Should throw error if not logged in", async () => {
        expect.assertions(1);

        await expect(
            new Client("stackoverflow.com").getMe()
        ).rejects.toThrowError(ChatExchangeError);
    });

    describe("Login", () => {
        test("Should return logged in user", async () => {
            expect.assertions(2);

            const host: Host = "stackoverflow.com";

            const client = new Client(host);

            class BrowserMock extends Browser {
                loggedIn = true;
                get userId() {
                    return Promise.resolve(5);
                }
            }

            client._browser = new BrowserMock(client, host);

            const user = await client.getMe();

            expect(user).toBeInstanceOf(User);
            expect(user.id).toEqual(5);
        });

        test("Should throw if missing email", async () => {
            expect.assertions(1);

            await expect(
                new Client("stackoverflow.com").login("", "abc123")
            ).rejects.toThrowError(InvalidArgumentError);
        });

        test("Should throw if missing password", async () => {
            expect.assertions(1);

            await expect(
                new Client("stackoverflow.com").login("text@example.com", "")
            ).rejects.toThrowError(InvalidArgumentError);
        });

        test("Should throw if email is invalid", async () => {
            expect.assertions(1);

            await expect(
                new Client("stackexchange.com").login("invalid", "a12B$")
            ).rejects.toThrowError(InvalidArgumentError);
        });
    });

    test("Should throw error if invalid cookieString", async () => {
        expect.assertions(1);

        await expect(
            new Client("stackoverflow.com").loginCookie("")
        ).rejects.toThrowError(InvalidArgumentError);
    });

    test("Should attempt to login with a cookieString", async () => {
        expect.assertions(2);

        const loginCookieMock = jest.fn();

        class BrowserMock extends Browser {
            loginCookie = loginCookieMock;
        }

        const host: Host = "stackoverflow.com";

        const client = new Client(host);

        client._browser = new BrowserMock(client, host);

        const cookieStr = "testing";

        await client.loginCookie(cookieStr);

        expect(loginCookieMock).toHaveBeenCalledTimes(1);
        expect(loginCookieMock).toHaveBeenLastCalledWith(cookieStr);
    });

    test("Should return a Message on 'getMessage'", () => {
        expect.assertions(2);

        const host: Host = "meta.stackexchange.com";
        const client = new Client(host);

        const id = 29;

        const msg = client.getMessage(id);

        expect(msg).toBeInstanceOf(Message);
        expect(msg.id).toEqual(id);
    });

    test("Should return a User on 'getUser'", async () => {
        expect.assertions(2);

        const host: Host = "meta.stackexchange.com";
        const client = new Client(host);

        const id = 5;

        const user = client.getUser(id);

        expect(user).toBeInstanceOf(User);
        expect(user.id).toEqual(id);
    });

    test("Should attempt to join a room and fetch existing room", async () => {
        expect.assertions(2);

        class BrowserMock extends Browser {
            joinRoom = jest.fn();
        }

        const host: Host = "stackoverflow.com";

        const client = new Client(host);

        client._browser = new BrowserMock(client, host);

        var room = await client.joinRoom(5);

        expect(client._browser.joinRoom).toHaveBeenCalledWith(5);

        var room2 = client.getRoom(5);

        expect(room).toMatchObject(room2);
    });
});
