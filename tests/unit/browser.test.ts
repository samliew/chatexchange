import { Cookie, CookieJar } from "tough-cookie";
import type { URL } from "url";
import {
    Browser,
    DeleteMessageStatus,
    type IRoomSave,
} from "../../src/Browser";
import Client, { type Host } from "../../src/Client";
import { ChatExchangeError } from "../../src/Exceptions/ChatExchangeError";
import LoginError from "../../src/Exceptions/LoginError";
import Message from "../../src/Message";
import User from "../../src/User";
import createRoomBody from "../fixtures/create_room_body.json";
import updateRoomBody from "../fixtures/update_room_body.json";

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
            "https://chat\\..+\\.com/rooms/save": async () => ({
                statusCode: 302,
                headers: {
                    location: "/rooms/info/42/test-public-room-ce?tab=general",
                },
            }),
            "https://chat\\..+\\.com/rooms/info/\\d+": async () => ({
                ...common,
                body: await fs.readFile("./tests/mocks/room_info.html", {
                    encoding: "utf-8",
                }),
            }),
            "https://stackoverflow\\.com/": async () => ({
                ...common,
                body: '<div><input type="hidden" name="fkey" value="abc" /></div>',
            }),
            "https://stackexchange\\.com/": async () => common,
            "https://chat\\..+\\.com/messages/\\d+/delete": async () => ({
                ...common,
                body: "ok",
            }),
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
    beforeEach(() => jest.resetModules());

    describe("authentication", () => {
        it("should override 'stackexchange.com' host to 'meta.stackexchange.com'", async () => {
            expect.assertions(1);

            const host: Host = "stackexchange.com";
            const replacement = "meta.stackexchange.com";

            const client = new Client(host);
            const browser = new Browser(client);

            expect(browser.loginHost).toEqual(replacement);
        });

        it("should return a cookie string on successful login", async () => {
            const mockCookieGetter = jest.fn();
            jest.doMock("tough-cookie", () => {
                const cookie = jest.requireActual("tough-cookie");
                cookie.CookieJar.prototype.getCookies = mockCookieGetter;
                return cookie;
            });

            const { Browser } = await import("../../src/Browser");

            const client = new Client("meta.stackexchange.com");
            const browser = new Browser(client);

            mockCookieGetter.mockReturnValueOnce([{ key: "acct" }]);

            const cookie = await browser.login("bogus@email.com", "123");
            expect(cookie).toBeTruthy();
        });

        it("should throw a ScrapingError on failure to get fkey", async () => {
            const mockGot = jest.fn();
            jest.doMock("got", () =>
                Object.assign(mockGot, { extend: mockGot })
            );

            const { Browser } = await import("../../src/Browser");
            const { ScrapingError } = await import(
                "../../src/Exceptions/ScrapingError"
            );

            const client = new Client("stackexchange.com");
            const browser = new Browser(client);

            mockGot.mockReturnValueOnce({
                statusCode: 200,
                body: "",
            });

            await expect(
                browser.login("bogus@email.com", "123")
            ).rejects.toThrow(ScrapingError);
        });

        it("should throw a LoginError on not being able to login", async () => {
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
        it(Browser.prototype.getProfile.name, async () => {
            expect.assertions(9);

            const mockGot = jest.fn();
            jest.doMock("got", () => {
                return Object.assign(mockGot, { extend: mockGot });
            });

            const { default: Browser } = await import("../../src/Browser");
            const { ScrapingError } = await import(
                "../../src/Exceptions/ScrapingError"
            );

            const client = new Client("meta.stackexchange.com");
            const browser = new Browser(client);

            const mockLseen = "n/a";
            const mockLmsg = "just now";
            const mockRep = 9001;
            const mockParentId = 42;
            const mockProfile = `
            <div class="reputation-score" title="${mockRep}">
                <table>
                    <td class="user-keycell">last message</td>
                    <td class="user-valuecell">${mockLmsg}</td>
                    <td class="user-keycell">last seen</td>
                    <td class="user-valuecell">${mockLseen}</td>
                    <td class="user-keycell">parent user</td>
                    <td class="user-valuecell">
                        <a href="//stackoverflow.com/users/${mockParentId}/answer">Answer</a>
                    </td>
                </table>
            </div>`;

            mockGot.mockReturnValueOnce({
                statusCode: 200,
                body: mockProfile,
            });

            const {
                reputation,
                lastMessage,
                lastSeen,
                parentId,
                parentHost,
                parentSite,
            } = await browser.getProfile(-1);

            expect(reputation).toEqual(mockRep);
            expect(lastMessage).toEqual(0);
            expect(lastSeen).toEqual(-1);
            expect(parentId).toEqual(42);
            expect(parentHost).toEqual("stackoverflow.com");
            expect(parentSite).toEqual("stackoverflow.com");

            const emptyResponse = "";

            mockGot.mockReturnValueOnce({
                statusCode: 200,
                body: emptyResponse,
            });

            const empty = await browser.getProfile(-1);
            expect(empty.reputation).toEqual(1);
            expect(empty.parentId).toBeUndefined();

            mockGot.mockReturnValueOnce({
                statusCode: 404,
                body: "not found",
            });

            await expect(browser.getProfile(0)).rejects.toBeInstanceOf(
                ScrapingError
            );
        });
    });

    describe("getters", () => {
        it("should throw a ScrapingError on missing fkey from transcript", async () => {
            expect.assertions(1);

            const mockGot = jest.fn();
            jest.doMock("got", () =>
                Object.assign(mockGot, { extend: mockGot })
            );

            mockGot.mockReturnValue({ statusCode: 200, body: "" });

            const { Browser } = await import("../../src/Browser");
            const { ScrapingError } = await import(
                "../../src/Exceptions/ScrapingError"
            );

            const client = new Client("stackoverflow.com");
            const browser = new Browser(client);

            await expect(browser.chatFKey).rejects.toThrow(ScrapingError);
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

        describe(Browser.prototype.createRoom.name, () => {
            it("should attempt to create a room", async () => {
                expect.assertions(1);

                const host: Host = "stackexchange.com";
                const client = new Client(host);
                const browser = new Browser(client);

                const roomId = await browser.createRoom(
                    createRoomBody as IRoomSave
                );

                expect(roomId).toEqual(42);
            });

            it("should throw a ChatExchangeError on room creation failure", async () => {
                const mockGot = jest.fn();
                jest.doMock("got", () => {
                    return Object.assign(mockGot, { extend: mockGot });
                });
    
                const { default: Browser } = await import("../../src/Browser");
                const { ChatExchangeError } = await import(
                    "../../src/Exceptions/ChatExchangeError"
                );
    
                mockGot.mockReturnValueOnce({
                    statusCode: 400,
                    body: "Bad request",
                });
    
                const client = new Client("stackexchange.com");
                const browser = new Browser(client);
    
                await expect(
                    browser.createRoom(createRoomBody as IRoomSave)
                ).rejects.toThrowError(ChatExchangeError);
            });
        });

        describe(Browser.prototype.updateRoom.name, () => {
            it("should attempt to update a room", async () => {
                expect.assertions(1);

                const host: Host = "stackexchange.com";
                const client = new Client(host);
                const browser = new Browser(client);

                const roomId = await browser.updateRoom(
                    42,
                    updateRoomBody as IRoomSave
                );

                expect(roomId).toEqual(42);
            });
        });

        describe(Browser.prototype.joinRoom.name, () => {
            it("should attempt to join the room", async () => {
                expect.assertions(2);

                const host: Host = "stackexchange.com";
                const client = new Client(host);
                const browser = new Browser(client);

                const joinViaId = await browser.joinRoom(roomId);
                expect(joinViaId).toEqual(true);

                const room = client.getRoom(roomId);

                const joinViaRoom = await browser.joinRoom(room);
                expect(joinViaRoom).toEqual(true);
            });
        });

        describe(Browser.prototype.leaveRoom.name, () => {
            it("should attempt to leave the room", async () => {
                expect.assertions(2);

                const client = new Client("meta.stackexchange.com");
                const browser = new Browser(client);

                const leaveViaId = await browser.leaveRoom(roomId);
                expect(leaveViaId).toEqual(true);

                const room = client.getRoom(roomId);

                const leaveViaRoom = await browser.leaveRoom(room);
                expect(leaveViaRoom).toEqual(true);
            });
        });

        describe(Browser.prototype.leaveAllRooms.name, () => {
            it("should attempt to leave all rooms", async () => {
                expect.assertions(1);

                const client = new Client("stackoverflow.com");
                const browser = new Browser(client);

                const status = await browser.leaveAllRooms();
                expect(status).toEqual(true);
            });
        });
    });

    describe("watching", () => {
        describe(Browser.prototype.watchRoom.name, () => {
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
        describe(Browser.prototype.sendMessage.name, () => {
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

                const client = new Client("stackexchange.com");
                const browser = new MockedBrowser(client);

                const msg = await browser.sendMessage(roomId, text);

                expect(msg).toBeInstanceOf(Message);
                expect(await msg.roomId).toEqual(roomId);
                expect(await msg.content).toEqual(text);
            });
        });

        describe(Browser.prototype.deleteMessage.name, () => {
            it("should attempt to delete a message", async () => {
                expect.assertions(1);

                const client = new Client("meta.stackexchange.com");
                const browser = new Browser(client);

                expect(await browser.deleteMessage(42)).toEqual(
                    DeleteMessageStatus.SUCCESS
                );
            });
        });
    });

    describe("room info", () => {
        describe(Browser.prototype.listUsers.name, () => {
            it("should correctly list users in the room", async () => {
                expect.assertions(4);

                const { default: Browser } = await import("../../src/Browser");

                const client = new Client("stackoverflow.com");
                const browser = new Browser(client);

                const users = await browser.listUsers(42);
                expect(users.length).toEqual(7);

                const [user] = users;

                expect(user.id).toEqual(11407695);
                expect(await user.isModerator).toBe(false);
                expect(await user.about).not.toBe(undefined);
            });
        });
    });
});
