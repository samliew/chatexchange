import { readFile } from "fs/promises";
import WebSocket from "ws";
import Browser from "../../src/Browser";
import Client, { Host } from "../../src/Client";
import InvalidArgumentError from "../../src/Exceptions/InvalidArgumentError";
import Message from "../../src/Message";
import Room from "../../src/Room";
import User from "../../src/User";
import type { ChatEvent } from "../../src/WebsocketEvent";
import WebsocketEvent, { ChatEventType } from "../../src/WebsocketEvent";

describe("Room", () => {

    describe("getters", () => {
        test("should correctly get transcript URL", () => {
            const client = new Client("stackexchange.com");
            const { transcriptURL } = client.getRoom(42);
            expect(transcriptURL).toEqual("https://chat.stackexchange.com/transcript/42");
        });
    });

    describe("blocking users", () => {
        beforeEach(() => jest.resetModules());

        test("should correctly block users", () => {
            expect.assertions(2);
            const client = new Client("stackoverflow.com");
            const roomId = 42;
            const room = new Room(client, roomId);

            const user1 = new User(client, -1);
            room.block(user1);

            const user2 = new User(client, -2);
            room.block(user2.id);

            expect(room.isBlocked(user1)).toBe(true);
            expect(room.isBlocked(user2)).toBe(true);
        });

        test("should unblock users after a timeout if one passed", async () => {
            expect.assertions(2);

            const client = new Client("stackoverflow.com");
            const roomId = 42;
            const room = new Room(client, roomId);

            const user = new User(client, -1);

            jest.useFakeTimers();

            room.block(user, 5);

            expect(room.isBlocked(user)).toBe(true);

            jest.runAllTimers();

            // https://github.com/facebook/jest/issues/2157
            await Promise.resolve();

            expect(room.isBlocked(user)).toBe(false);

            jest.useRealTimers();
        });

        test("should correctly unblock users", () => {
            expect.assertions(4);

            const client = new Client("stackoverflow.com");
            const roomId = 42;
            const room = new Room(client, roomId);

            const user1 = new User(client, -1);
            room.block(user1);

            const user2 = new User(client, -2);
            room.block(user2);

            // making sure the users are actually blocked
            expect(room.isBlocked(user1)).toBe(true);
            expect(room.isBlocked(user2)).toBe(true);

            room.unblock(user1);
            room.unblock(user2);

            expect(room.isBlocked(user1)).toBe(false);
            expect(room.isBlocked(user2)).toBe(false);
        });

        test("should stop passing messages from blocked users", async () => {
            const mockGot = jest.fn();

            mockGot
                .mockResolvedValueOnce({
                    statusCode: 200,
                    body: { time: Date.now() },
                })
                .mockResolvedValueOnce({
                    statusCode: 200,
                    body: {
                        url: "wss://chat.sockets.stackexchange.com/events/1/42",
                    },
                });

            jest.doMock("got", () =>
                Object.assign(mockGot, { extend: jest.fn() })
            );

            const events = { r42: { e: [{ user_id: 24 }, { user_id: 42 }] } };

            const mockWatchRoom = jest.fn(() => ({
                on: (m: string, cbk: Function) =>
                    m === "close" || cbk(JSON.stringify(events)),
            }));

            jest.doMock("../../src/Browser", () => {
                const { default: Browser } =
                    jest.requireActual("../../src/Browser");
                return class MockBrowser extends Browser {
                    get chatFKey() {
                        return "abs";
                    }
                    watchRoom() {
                        return mockWatchRoom();
                    }
                };
            });

            const { default: Room } = await import("../../src/Room");
            const { default: Client } = await import("../../src/Client");

            const client = new Client("stackexchange.com");
            const roomId = 42;
            const userId = 24;

            const room = new Room(client, roomId);
            room.block(userId);

            const promise = new Promise((r) => room.on("message", r));

            await room.join();
            await room.watch();

            const msg = (await promise) as WebsocketEvent;
            expect(msg.userId).not.toBe(userId);
        });
    });

    describe("ignoring events", () => {
        beforeEach(() => jest.resetModules());

        test("should correctly ignore event types", () => {
            expect.assertions(1);

            const client = new Client("stackoverflow.com");
            const roomId = 42;

            const ignored = ChatEventType.FILE_ADDED;

            const room = new Room(client, roomId);
            room.ignore(ignored);

            expect(room.isIgnored(ignored)).toBe(true);
        });

        test("should correctly unignore event types", () => {
            expect.assertions(2);

            const client = new Client("stackoverflow.com");
            const roomId = 42;

            const ignored = ChatEventType.FILE_ADDED;

            const room = new Room(client, roomId);
            room.ignore(ignored);

            expect(room.isIgnored(ignored)).toBe(true);

            room.unignore(ignored);

            expect(room.isIgnored(ignored)).toBe(false);
        });

        jest.setTimeout(10000);

        test("should not emit message events for ignored types", async () => {
            const mockGot = jest.fn();

            mockGot
                .mockResolvedValueOnce({
                    statusCode: 200,
                    body: { time: Date.now() },
                })
                .mockResolvedValueOnce({
                    statusCode: 200,
                    body: {
                        url: "wss://chat.sockets.stackexchange.com/events/1/42",
                    },
                });

            jest.doMock("got", () =>
                Object.assign(mockGot, { extend: jest.fn() })
            );

            const ignored = ChatEventType.USER_LEFT;
            const notIgnored = ChatEventType.MESSAGE_POSTED;

            const events = {
                r42: {
                    e: [
                        { event_type: ignored, user_id: 42 },
                        { event_type: notIgnored, user_id: 24 },
                    ],
                },
            };

            const mockWatchRoom = jest.fn(() => ({
                on: (m: string, cbk: Function) =>
                    m === "close" || cbk(JSON.stringify(events)),
            }));

            jest.doMock("../../src/Browser", () => {
                const { default: Browser } =
                    jest.requireActual("../../src/Browser");
                return class MockBrowser extends Browser {
                    get chatFKey() {
                        return "abs";
                    }
                    watchRoom() {
                        return mockWatchRoom();
                    }
                };
            });

            const { default: Room } = await import("../../src/Room");
            const { default: Client } = await import("../../src/Client");

            const client = new Client("stackexchange.com");
            const roomId = 42;

            const room = new Room(client, roomId);
            room.ignore(ignored);

            const promise = new Promise((r) => room.on("message", r));

            await room.join();
            await room.watch();

            const msg = (await promise) as WebsocketEvent;
            expect(msg.eventType).toBe(notIgnored);
        });

        test("should ignore all other events if added via Room#only()", () => {
            const roomId = 5;
            const client = new Client("stackoverflow.com");
            const room = new Room(client, roomId);

            room.only(ChatEventType.FILE_ADDED);

            Object.values(ChatEventType).forEach((v) => {
                const ignored = room.isIgnored(v as ChatEventType);
                expect(v === ChatEventType.FILE_ADDED || ignored).toBe(true);
            });
        });
    });

    it("Should create a room with id", () => {
        expect.assertions(1);

        const roomId = 5;
        const client = new Client("stackoverflow.com");
        const room = new Room(client, roomId);
        expect(room.id).toEqual(roomId);
    });

    it("Should attempt to join/leave a room", async () => {
        expect.assertions(2);

        const roomId = 5;
        const host: Host = "stackoverflow.com";

        class MockBrowser extends Browser {
            joinRoom = jest.fn();
            leaveRoom = jest.fn();
        }

        const client = new Client(host);
        const browser = new MockBrowser(client);
        const room = new Room(client, roomId);

        await room.join();
        await room.leave();

        expect(browser.joinRoom).toHaveBeenCalledWith(room);
        expect(browser.leaveRoom).toHaveBeenCalledWith(room);
    });

    describe("sendMessage", () => {
        it("Should attempt to send a message", async () => {
            expect.assertions(1);

            const roomId = 5;
            const host: Host = "stackoverflow.com";

            class MockBrowser extends Browser {
                sendMessage = jest.fn();
            }

            const client = new Client(host);
            const browser = new MockBrowser(client);
            const room = new Room(client, roomId);

            await room.sendMessage("This is a test message");

            expect(browser.sendMessage).lastCalledWith(
                roomId,
                "This is a test message"
            );
        });

        it("Should throw an error for text > 500 chars", async () => {
            expect.assertions(1);

            const roomId = 5;
            const client = new Client("stackoverflow.com");
            const room = new Room(client, roomId);

            expect(
                room.sendMessage(`
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean aliquet auctor sem, luctus sodales orci egestas id.
                Nullam sit amet mi turpis. Etiam nec nibh id dolor semper imperdiet ut vitae odio. Vestibulum sagittis est sed augue euismod finibus.
                Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Integer in dui non lectus pellentesque porta
                sit amet vitae est. In blandit felis non sapien consectetur egestas. Proin ac dignissim lectus. In hac massa nunc.`)
            ).rejects.toThrowError(InvalidArgumentError);
        });

        it("Should throw an error for text is empty", async () => {
            expect.assertions(2);

            const roomId = 5;

            const client = new Client("stackoverflow.com");
            const room = new Room(client, roomId);

            expect(room.sendMessage("")).rejects.toThrowError(
                InvalidArgumentError
            );

            //@ts-expect-error
            expect(room.sendMessage()).rejects.toThrowError(
                InvalidArgumentError
            );
        });
    });

    it("Should attempt to watch the room, and attach websockets", async () => {
        expect.assertions(2);

        const roomId = 5;
        const host: Host = "stackoverflow.com";

        const mockWebsocketOn = jest.fn();

        class MockWebSocket extends WebSocket {
            on = mockWebsocketOn;
        }

        //@ts-ignore
        const socket = new MockWebSocket(null);

        const mockWebsocketGetter = jest.fn(() => Promise.resolve(socket));

        const mockWebsocketWatch = jest.fn(() => mockWebsocketGetter());

        class MockBrowser extends Browser {
            watchRoom = mockWebsocketWatch;
        }

        const client = new Client(host);
        new MockBrowser(client);

        const room = new Room(client, roomId);

        await room.watch();

        expect(mockWebsocketWatch).toHaveBeenCalledWith(room);
        expect(mockWebsocketOn).toBeCalledTimes(2);
    });

    it("Should fire an event", async () => {
        expect.assertions(11);

        const roomId = 5;
        const host: Host = "stackoverflow.com";

        jest.doMock("ws", () => {
            const ws = jest.requireActual("ws");
            ws.prototype.close = () => void 0;
            return ws;
        });

        const { default: WebSocket } = await import("ws");

        //@ts-ignore
        const websocketMock = new WebSocket(null);

        class MockBrowser extends Browser {
            sendMessage = jest.fn();
            leaveRoom = jest.fn();
            watchRoom = jest.fn(() => Promise.resolve(websocketMock));
        }

        const client = new Client(host);
        const browser = new MockBrowser(client);

        const room = new Room(client, roomId);

        const event: ChatEvent = JSON.parse(
            await readFile("./tests/events/6.json", { encoding: "utf-8" })
        );

        const wrappedEvent = { r5: { e: [event] } };

        const messageSpy = jest.fn();
        const closeSpy = jest.fn();

        room.on("message", messageSpy);
        room.on("close", closeSpy);

        await room.watch();

        websocketMock.emit("message", JSON.stringify(wrappedEvent));
        websocketMock.emit("message", "{}");

        expect(browser.watchRoom).toHaveBeenCalledTimes(1);
        expect(browser.watchRoom).toHaveBeenCalledWith(room);

        // Simulate server disconnect
        websocketMock.emit("close");

        expect(browser.watchRoom).toHaveBeenCalledTimes(2);
        expect(browser.watchRoom).toHaveBeenCalledWith(room);

        expect(messageSpy).toHaveBeenCalledTimes(1);
        expect(closeSpy).toHaveBeenCalledTimes(0);
        expect(browser.leaveRoom).toHaveBeenCalledTimes(0);

        await room.leave();

        expect(browser.leaveRoom).toHaveBeenCalledWith(room);

        websocketMock.emit("close");

        expect(closeSpy).toHaveBeenCalledTimes(1);

        const [[msg]] = messageSpy.mock.calls;

        expect(msg).toBeInstanceOf(Message);
        expect(msg.id).toEqual(44396284);
    });
});
