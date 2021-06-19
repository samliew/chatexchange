import * as cheerio from "cheerio";
import { Cookie, CookieJar } from "tough-cookie";
import Browser from "../../src/Browser";
import Client, { Host } from "../../src/Client";
import InternalError from "../../src/Exceptions/InternalError";
import LoginError from "../../src/Exceptions/LoginError";
import Message from "../../src/Message";
import User from "../../src/User";

describe("Browser", () => {
    describe("authentication", () => {
        it("should override 'stackexchange.com' host to 'meta.stackexchange.com'", async () => {
            expect.assertions(1);

            const _get$mock = jest.fn(() =>
                Promise.resolve(
                    cheerio.load("<input name='fkey' value='test'/>")
                )
            );

            //@ts-expect-error
            class MockBrowser extends Browser {
                _get$ = _get$mock;
                _getCookie(str: string) {
                    return new Cookie();
                }
                _post() {
                    return Promise.resolve();
                }
            }

            const host: Host = "stackexchange.com";
            const replacement = "meta.stackexchange.com";

            const client = new Client(host);
            //@ts-expect-error
            client._browser = null;

            const browser = new MockBrowser(client);

            browser.login("ex@ample.org", "a!z5R_+@/|g-[%");

            expect(_get$mock).toHaveBeenCalledWith(
                `https://${replacement}/users/login`
            );
        });

        it("should throw on being unable to verify cookie", async () => {
            expect.assertions(1);

            const _get$mock = jest.fn(() => Promise.resolve(cheerio.load("")));

            //@ts-expect-error
            class MockBrowser extends Browser {
                _get$ = _get$mock;
            }

            const host: Host = "stackoverflow.com";

            const client = new Client(host);

            //@ts-expect-error
            client._browser = null;

            const browser = new MockBrowser(client);

            const jar = new CookieJar();
            const cookie = Cookie.parse("name=test; SameSite=None; Secure")!;

            await jar.setCookie(cookie, host);

            const login = browser.loginCookie(jar.serializeSync());

            await expect(login).rejects.toThrow(LoginError);
        });
    });

    describe("getters", () => {
        it("should throw on missing fkey from transcript", async () => {
            expect.assertions(1);

            const host: Host = "stackoverflow.com";
            const client = new Client(host);

            //@ts-expect-error
            client._browser = null;

            const _get$mock = jest.fn(() => Promise.resolve(cheerio.load("")));

            //@ts-expect-error
            class MockBrowser extends Browser {
                _get$ = _get$mock;
            }

            const browser = new MockBrowser(client);

            await expect(browser.chatFKey).rejects.toThrow(InternalError);
        });
    });

    describe("room interaction", () => {
        it("should attempt to join and leave room", async () => {
            expect.assertions(2);

            const host: Host = "stackexchange.com";
            const client = new Client(host);

            //@ts-expect-error
            client._browser = null;

            const _postKeyMock = jest.fn(() =>
                Promise.resolve({ body: { time: Date.now() } })
            );

            //@ts-expect-error
            class MockedBrowser extends Browser {
                _postKeyed = _postKeyMock;
            }

            const browser = new MockedBrowser(client);

            const roomId = 29;

            await browser.joinRoom(roomId);

            expect(_postKeyMock).toHaveBeenCalledWith(
                `chats/${roomId}/events`,
                {
                    mode: "Messages",
                    msgCount: 100,
                    since: 0,
                }
            );

            await browser.leaveRoom(roomId)

            expect(_postKeyMock).toHaveBeenCalledWith(
                `chats/leave/${roomId}`,
                {
                    quiet: true,
                }
            );

        });
    });

    describe("messaging", () => {
        beforeEach(() => jest.resetModules());

        it("should attempt to send a message", async () => {
            expect.assertions(4);

            const host: Host = "stackexchange.com";
            const roomId = 29;
            const text = "It's alive!";

            const _postKeyMock = jest.fn(() => Promise.resolve({ id: 123 }));

            //@ts-ignore
            class MockedBrowser extends Browser {
                _postKeyed = _postKeyMock;
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

            const client = new Client(host);
            // @ts-ignore
            client._browser = new MockedBrowser(client)

            const msg = await client._browser.sendMessage(roomId, text);

            expect(_postKeyMock).toHaveBeenCalledWith(
                `chats/${roomId}/messages/new`,
                { text }
            );

            expect(msg).toBeInstanceOf(Message);
            expect(await msg.roomId).toEqual(roomId);
            expect(await msg.content).toEqual(text);
        });
    });

    
});
