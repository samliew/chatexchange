import { Cookie, CookieJar } from "tough-cookie";
import { Browser } from "../../src/Browser";
import Client, { Host } from "../../src/Client";
import LoginError from "../../src/Exceptions/LoginError";
import Message from "../../src/Message";
import User from "../../src/User";

jest.mock("got", () => {
    const fn = jest.fn(async (url: string) => {
        const fs = await import("fs/promises");

        const common = { statusCode: 200, body: "" };

        const resMap: Record<string, () => Promise<unknown>> = {
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
});

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

    describe("getters", () => {
        beforeEach(() => jest.resetModules());

        it("should throw on missing fkey from transcript", async () => {
            expect.assertions(1);

            jest.doMock("cheerio");

            const cheerio = (await import(
                "cheerio"
            )) as any as jest.Mocked<cheerio.CheerioAPI>;

            cheerio.load.mockReturnValue(
                jest.requireActual("cheerio").load("")
            );

            const { Browser } = await import("../../src/Browser");
            const { InternalError } = await import(
                "../../src/Exceptions/InternalError"
            );

            const host: Host = "stackoverflow.com";
            const client = new Client(host);
            const browser = new Browser(client);

            await expect(browser.chatFKey).rejects.toThrow(InternalError);
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
