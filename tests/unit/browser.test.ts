import * as cheerio from "cheerio";
import { Cookie, CookieJar } from "tough-cookie";
import Browser from "../../src/Browser";
import Client, { Host } from "../../src/Client";
import LoginError from "../../src/Exceptions/LoginError";
import Message from "../../src/Message";

describe("Browser", () => {
    describe("authentication", () => {
        it("should override 'stackexchange.com' host to 'meta.stackexchange.com'", async () => {
            const _get$mock = jest.fn(() =>
                Promise.resolve(
                    cheerio.load("<input name='fkey' value='test'/>")
                )
            );

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

            const mocked = new MockBrowser(new Client(host), host);

            mocked.login("ex@ample.org", "a!z5R_+@/|g-[%");

            expect(_get$mock).toHaveBeenCalledWith(
                `https://${replacement}/users/login`
            );
        });

        it("should throw on being unable to verify cookie", async () => {
            const _get$mock = jest.fn(() => Promise.resolve(cheerio.load("")));

            class MockBrowser extends Browser {
                _get$ = _get$mock;
            }

            const host: Host = "stackoverflow.com";

            const browser = new MockBrowser(new Client(host), host);

            const jar = new CookieJar();
            const cookie = Cookie.parse("name=test; SameSite=None; Secure")!;

            await jar.setCookie(cookie, host);

            const login = browser.loginCookie(jar.serializeSync());

            await expect(login).rejects.toThrow(LoginError);
        });
    });

    describe("room interaction", () => {
        it("should attempt to send a message event", async () => {
            expect.assertions(1);

            const host: Host = "stackexchange.com";
            const client = new Client(host);

            const _postKeyMock = jest.fn(() =>
                Promise.resolve({ body: { time: Date.now() } })
            );

            class MockedBrowser extends Browser {
                _postKeyed = _postKeyMock;
            }

            const browser = new MockedBrowser(client, host);

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
        });
    });

    describe("messaging", () => {
        it("should attempt to send a message", async () => {
            expect.assertions(4);

            const host: Host = "stackexchange.com";
            const client = new Client(host);

            const _postKeyMock = jest.fn(() => Promise.resolve({ id: 123 }));

            const roomId = 29;
            const text = "It's alive!";

            class MockedBrowser extends Browser {
                _postKeyed = _postKeyMock;
                getTranscript() {
                    return Promise.resolve({
                        content: text,
                        edited: false,
                        id: 456,
                        parentMessageId: 789,
                        roomId,
                        roomName: "Test",
                    });
                }
            }

            const browser = new MockedBrowser(client, host);

            const msg = await browser.sendMessage(roomId, text);

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
