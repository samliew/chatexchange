import { Cookie, CookieJar } from "tough-cookie";
import type { URL } from "url";
import { Browser } from "../../src/Browser";
import Client, { Host } from "../../src/Client";
import { ChatExchangeError } from "../../src/Exceptions/ChatExchangeError";
import LoginError from "../../src/Exceptions/LoginError";
import Message from "../../src/Message";
import User from "../../src/User";

function mockGot() {
    const fn = jest.fn(async (url: string) => {
        const fs = await import("fs/promises");

        const common = { statusCode: 200, body: "" };

        const resMap: Record<string, () => Promise<unknown>> = {
            "https://chat\\..+\\.com/ws-auth": async () => ({
                ...common,
                body: {
                    url: "wss://chat.sockets.stackexchange.com/events/1/42",
                },
            }),
            "https://meta\\.stackexchange\\.com/users/login": async () => ({
                ...common,
                body: "<input name='fkey' value='test'/>",
            }),
            "https://chat\\..+\\.com/chats/join/favorite": async () => ({
                ...common,
                body: await fs.readFile("./tests/mocks/favorite.html", {
                    encoding: "utf-8",
                }),
            }),
            "https://stackoverflow\\.com/": async () => ({
                ...common,
                body: '<div class="my-profile"></div>',
            }),
            "https://stackexchange\\.com/": async () => common,
            "https://chat\\..+\\.com/chats/\\d+/events": () =>
                Promise.resolve({
                    ...common,
                    body: { time: Date.now() },
                }),
            "https://chat\\..+\\.com/chats/leave/(?:\\d+|all)": async () =>
                common,
            "https://chat\\..+\\.com/chats/\\d+/messages/new": () =>
                Promise.resolve({ ...common, body: { id: 1 } }),
        };

        const [, handler] =
            Object.entries(resMap).find(([k]) => new RegExp(k).test(url)) || [];

        handler || console.log({ url });

        return handler?.();
    });

    return Object.assign(fn, { extend: () => fn });
}

jest.mock("got", mockGot);

describe("Browser", () => {
    describe("authentication", () => {
        it("should override 'stackexchange.com' host to 'meta.stackexchange.com'", async () => {
            expect.assertions(1);

            const host: Host = "stackexchange.com";
            const replacement = "meta.stackexchange.com";

            const client = new Client(host);
            const browser = new Browser(client);

            expect(browser.loginHost).toEqual(replacement);
        });

        it("should throw on not being able to login", async () => {
            const client = new Client("stackexchange.com");
            const browser = new Browser(client);

            await expect(
                browser.login("bogus@email.com", "123")
            ).rejects.toThrow(LoginError);
        });

        it("should throw on being unable to verify cookie", async () => {
            expect.assertions(1);

            const host: Host = "stackexchange.com";
            const client = new Client(host);
            const browser = new Browser(client);

            const jar = new CookieJar();
            const cookie = Cookie.parse("name=test; SameSite=None; Secure")!;
            await jar.setCookie(cookie, host);

            const login = browser.loginCookie(jar.serializeSync());

            await expect(login).rejects.toThrow(LoginError);
        });

        it("should set loggedIn property on cookie success", async () => {
            expect.assertions(1);

            const host: Host = "stackoverflow.com";
            const client = new Client(host);
            const browser = new Browser(client);

            const jar = new CookieJar();
            const cookie = Cookie.parse("name=test; SameSite=None; Secure")!;
            await jar.setCookie(cookie, host);

            await browser.loginCookie(jar.serializeSync());

            expect(browser.loggedIn).toEqual(true);
        });
    });

    describe("profile scraping", () => {
        beforeEach(() => jest.resetModules());

        it("getProfile", async () => {
            expect.assertions(4);

            const mockGot = jest.fn();
            jest.doMock("got", () => {
                return Object.assign(mockGot, { extend: mockGot });
            });

            const { default: Browser } = await import("../../src/Browser");

            const client = new Client("meta.stackexchange.com");
            const browser = new Browser(client);

            const mockLseen = "n/a";
            const mockLmsg = "just now";
            const mockRep = 9001;
            const mockProfile = `
            <div class="reputation-score" title="${mockRep}">
                <table>
                    <td class="user-keycell">last message</td>
                    <td class="user-valuecell">${mockLmsg}</td>
                    <td class="user-keycell">last seen</td>
                    <td class="user-valuecell">${mockLseen}</td>
                </table>
            </div>`;

            mockGot.mockReturnValueOnce({
                statusCode: 200,
                body: mockProfile,
            });

            const { reputation, lastMessage, lastSeen } =
                await browser.getProfile(-1);

            expect(reputation).toEqual(mockRep);
            expect(lastMessage).toEqual(0);
            expect(lastSeen).toEqual(-1);

            const emptyResponse = "";

            mockGot.mockReturnValueOnce({
                statusCode: 200,
                body: emptyResponse,
            });

            const empty = await browser.getProfile(-1);
            expect(empty.reputation).toEqual(1);
        });
    });

    describe("getters", () => {
        beforeEach(() => jest.resetModules());

        it("should throw on missing fkey from transcript", async () => {
            expect.assertions(1);

            const mockGot = jest.fn();
            jest.doMock("got", () =>
                Object.assign(mockGot, { extend: mockGot })
            );

            mockGot.mockReturnValue({ statusCode: 200, body: "" });

            const { Browser } = await import("../../src/Browser");
            const { InternalError } = await import(
                "../../src/Exceptions/InternalError"
            );

            const client = new Client("stackoverflow.com");
            const browser = new Browser(client);

            await expect(browser.chatFKey).rejects.toThrow(InternalError);
        });

        it("should correctly return user-related properties", async () => {
            expect.assertions(2);

            const client = new Client("stackoverflow.com");
            const browser = new Browser(client);

            await expect(browser.userId).resolves.toEqual(10162108);
            await expect(browser.userName).resolves.toEqual("spotdetector");
        });
    });

    describe("room interaction", () => {
        const roomId = 29;

        it("should attempt to join the room", async () => {
            expect.assertions(1);

            const host: Host = "stackexchange.com";
            const client = new Client(host);
            const browser = new Browser(client);

            const joinStatus = await browser.joinRoom(roomId);
            expect(joinStatus).toEqual(true);
        });

        it("should attempt to leave the room", async () => {
            expect.assertions(1);

            const client = new Client("meta.stackexchange.com");
            const browser = new Browser(client);

            const leaveStatus = await browser.leaveRoom(roomId);
            expect(leaveStatus).toEqual(true);
        });

        it("should attempt to leave all rooms", async () => {
            expect.assertions(1);

            const client = new Client("stackoverflow.com");
            const browser = new Browser(client);

            const status = await browser.leaveAllRooms();
            expect(status).toEqual(true);
        });
    });

    describe("watching", () => {
        describe("watchRoom", () => {
            beforeEach(() => jest.resetModules());

            it("should throw on missing time key", async () => {
                expect.assertions(1);

                const client = new Client("stackexchange.com");
                const browser = new Browser(client);

                const watch = browser.watchRoom(Infinity);

                await expect(watch).rejects.toThrow(ChatExchangeError);
            });

            it("should attempt to connect via WebSockets", async () => {
                expect.assertions(5);

                jest.doMock("got", mockGot);

                const mockWSconstructor = jest.fn((_u, _o) => ({
                    once: (_e: string, cbk: Function) => cbk(),
                }));

                jest.doMock("ws", () => mockWSconstructor);

                const { Browser } = await import("../../src/Browser");

                const client = new Client("stackoverflow.com");
                const browser = new Browser(client);

                const roomId = 29;

                const status = await browser.joinRoom(roomId);
                expect(status).toEqual(true);

                await browser.watchRoom(roomId);

                const [[wss, opts]]: [URL, object][] =
                    mockWSconstructor.mock.calls;

                expect(mockWSconstructor).toBeCalledTimes(1);
                expect(wss.protocol).toEqual("wss:");
                expect(wss.searchParams.has("l")).toBe(true);
                expect(opts).toEqual({ origin: client.root });
            });
        });
    });

    describe("messaging", () => {
        it("should attempt to send a message", async () => {
            expect.assertions(3);

            const roomId = 29;
            const text = "It's alive!";

            class MockedBrowser extends Browser {
                getTranscript() {
                    return Promise.resolve({
                        content: text,
                        edited: false,
                        id: 456,
                        user: new User(client, 5),
                        parentMessageId: 789,
                        roomId,
                        roomName: "Test",
                    });
                }
            }

            const host: Host = "stackexchange.com";
            const client = new Client(host);
            const browser = new MockedBrowser(client);
            client._browser = browser;

            const msg = await browser.sendMessage(roomId, text);

            expect(msg).toBeInstanceOf(Message);
            expect(await msg.roomId).toEqual(roomId);
            expect(await msg.content).toEqual(text);
        });
    });
});
