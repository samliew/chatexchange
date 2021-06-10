import * as cheerio from "cheerio";
import { Cookie } from "tough-cookie";
import Browser from "../../src/Browser";
import Client, { Host } from "../../src/Client";
import Message from "../../src/Message";

describe("Browser", () => {
    describe("authentication", () => {
        it("should override 'stackexchange.com' host to 'meta.stackexchange.com'", async () => {
            const _get$mock = jest.fn(() =>
                Promise.resolve(
                    cheerio.load("<input name='fkey' value='test'/>")
                )
            );

            class MockInternals extends Browser {
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

            const mocked = new MockInternals(new Client(host), host);

            mocked.login("ex@ample.org", "a!z5R_+@/|g-[%");

            expect(_get$mock).toHaveBeenCalledWith(
                `https://${replacement}/users/login`
            );
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
