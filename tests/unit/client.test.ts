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
        expect(() => new Client("example.com")).toThrowError(
            InvalidArgumentError
        );
    });
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

            client._browser = new BrowserMock(client);

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

        client._browser = new BrowserMock(client);

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

    describe("Client user", () => {
        test("Should return a User on 'getUser'", async () => {
            expect.assertions(2);

            const host: Host = "meta.stackexchange.com";
            const client = new Client(host);

            const id = 5;

            const user = client.getUser(id);

            expect(user).toBeInstanceOf(User);
            expect(user.id).toEqual(id);
        });

        beforeEach(() => jest.resetModules());

        test('Should skip initialization on subsequent calls to "getUser"', async () => {
            expect.assertions(1);

            const mockUserConstructor = jest.fn();

            jest.doMock("../../src/User", () =>
                jest.fn().mockImplementation(mockUserConstructor)
            );

            const { default: Client } = await import("../../src/Client");
            const client = new Client("stackexchange.com");

            const userId = 42;
            client.getUser(userId, { about: "I am the answer" });
            client.getUser(userId);

            expect(mockUserConstructor).toBeCalledTimes(1);

            jest.unmock("../../src/User");
        });
    });

    test("Should attempt to join a room and fetch existing room", async () => {
        expect.assertions(2);

        const roomId = 5;
        const host: Host = "stackoverflow.com";

        class BrowserMock extends Browser {
            joinRoom = jest.fn();
        }

        const client = new Client(host);

        client._browser = new BrowserMock(client);

        const room = await client.joinRoom(roomId);
        const room2 = client.getRoom(roomId);

        expect(client._browser.joinRoom).toHaveBeenCalledWith(roomId);
        expect(room).toMatchObject(room2);
    });

    test("Should correctly get root", () => {
        expect.assertions(1);

        const hosts: Host[] = [
            "meta.stackexchange.com",
            "stackexchange.com",
            "stackoverflow.com",
        ];

        const clients = hosts.map((host) => new Client(host));
        const roots = clients.map(({ root }) => root);

        expect(roots).toEqual([
            "https://chat.meta.stackexchange.com/",
            "https://chat.stackexchange.com/",
            "https://chat.stackoverflow.com/",
        ]);
    });

    beforeEach(() => jest.resetModules());

    test("Should correctly get fkey", async () => {
        expect.assertions(1);

        const mockFkey = "42";

        jest.doMock("../../src/Browser", () => {
            const real = jest.requireActual("../../src/Browser");
            Object.defineProperty(real.default.prototype, "chatFKey", {
                get: () => Promise.resolve(mockFkey),
            });
            return real;
        });

        const { default: Client } = await import("../../src/Client");

        const client = new Client("stackexchange.com");

        await expect(client.fkey).resolves.toEqual(mockFkey);
    });

    describe("leaving rooms", () => {
        test("Should correctly leave all rooms", async () => {
            expect.assertions(2);

            const mockGot = jest.fn();

            jest.doMock("got", () =>
                Object.assign(mockGot, { extend: mockGot })
            );

            jest.doMock("../../src/Browser", () => {
                const real = jest.requireActual("../../src/Browser");
                real.default.joinRoom = () => Promise.resolve(true);
                return real;
            });

            mockGot.mockReturnValue({
                statusCode: 200,
                body: "<input name='fkey' value='test'/>",
            });

            const { default: Client } = await import("../../src/Client");

            const client = new Client("meta.stackexchange.com");

            await client.joinRoom(42);

            const status = await client.leaveAll();
            expect(status).toBe(true);

            const [_j1, _j2, _events, leave] = mockGot.mock.calls;

            const [url] = leave;
            expect(url).toMatch(/chats\/leave\/all/);
        });

        test("should return correct status on failing to leave rooms", async () => {
            expect.assertions(1);

            const mockGot = jest.fn();

            jest.doMock("got", () =>
                Object.assign(mockGot, { extend: mockGot })
            );

            mockGot.mockReturnValue({
                statusCode: 200,
                body: "<input name='fkey' value='test'/>",
            });

            const { default: Client } = await import("../../src/Client");

            const client = new Client("meta.stackexchange.com");

            await client.joinRoom(42);

            mockGot.mockReturnValue({
                statusCode: 301,
                body: "sorry, we changed ship",
            });

            const status = await client.leaveAll();
            expect(status).toBe(false);
        });
    });

    describe("broadcasting", () => {
        test("should return a status map of roomId -> status", async () => {
            expect.assertions(2);

            const mockSend = jest.fn();

            jest.doMock("../../src/Room", () => {
                const real = jest.requireActual<typeof import("../../src/Room")>("../../src/Room");
                real.default.prototype.sendMessage = mockSend;
                return real;
            });

            const { default: Client } = await import("../../src/Client");
            const client = new Client("meta.stackexchange.com");

            const fineId = 42;
            const brokenId = 24;

            client.getRoom(fineId);
            client.getRoom(brokenId);

            mockSend
                .mockResolvedValueOnce(void 0)
                .mockRejectedValueOnce(void 0);

            const statusMap = await client.broadcast("BBC wants to apologize for the following");

            expect(statusMap.get(fineId)).toBe(true);
            expect(statusMap.get(brokenId)).toBe(false);
        });
    });
});
