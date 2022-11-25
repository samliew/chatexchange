import WebSocket from "ws";
import Browser, { type IRoomSave } from "../../src/Browser";
import Client, { type Host } from "../../src/Client";
import InvalidArgumentError from "../../src/Exceptions/InvalidArgumentError";
import Message from "../../src/Message";
import Room from "../../src/Room";
import User from "../../src/User";
import WebsocketEvent, { ChatEventType } from "../../src/WebsocketEvent";
import chatEvent6 from "../events/6.json";
import updateRoomBody from "../fixtures/update_room_body.json";
import { makeMockClassExport } from "./utils";

const mockBrowser = makeMockClassExport<Browser>("../../src/Browser");
const mockClient = makeMockClassExport<Client>("../../src/Client");
const mockWS = makeMockClassExport<WebSocket>("ws");

describe("Room", () => {
    beforeEach(() => jest.resetModules());
    beforeEach(() => jest.useRealTimers());

    describe("instantiation", () => {
        it("Should instantiate with id", () => {
            expect.assertions(1);

            const roomId = 5;
            const client = new Client("stackoverflow.com");
            const room = new Room(client, roomId);
            expect(room.id).toEqual(roomId);
        });
    });

    describe("getters", () => {
        it("should correctly get transcript URL", () => {
            const client = new Client("stackexchange.com");
            const { transcriptURL } = client.getRoom(42);
            expect(transcriptURL).toEqual(
                "https://chat.stackexchange.com/transcript/42"
            );
        });
    });

    describe("room interaction", () => {
        describe(Room.prototype.update.name, () => {
            it(Room.prototype.update.name, async () => {
                expect.assertions(1);

                mockClient({
                    updateRoom: (room) => Promise.resolve(room as Room),
                });
                const { default: MockedClient } = await import(
                    "../../src/Client"
                );

                const room = new Room(
                    new MockedClient("stackexchange.com"),
                    42
                );

                await expect(
                    room.update(updateRoomBody as IRoomSave)
                ).resolves.toBe(true);
            });
        });

        describe(Room.prototype.join.name, () => {
            it("Should correctly join rooms", async () => {
                expect.assertions(1);

                mockClient({ joinRoom: () => Promise.resolve(true) });
                const { default: Client } = await import("../../src/Client");

                const client = new Client("stackoverflow.com");
                const room = new Room(client, 5);

                await expect(room.join()).resolves.toBe(true);
            });
        });

        describe(Room.prototype.leave.name, () => {
            it("Should correctly leave rooms", async () => {
                expect.assertions(1);

                mockClient({ leaveRoom: () => Promise.resolve(true) });
                const { default: Client } = await import("../../src/Client");

                const client = new Client("stackoverflow.com");
                const room = new Room(client, 5);

                await expect(room.leave()).resolves.toBe(true);
            });
        });

        describe(Room.prototype.sendMessage.name, () => {
            const client = new Client("stackoverflow.com");

            it("Should attempt to send a message", async () => {
                expect.assertions(2);

                const host: Host = "stackoverflow.com";

                mockClient({
                    send: (content) =>
                        Promise.resolve([
                            true,
                            new Message(client, 42, { content }),
                        ]),
                });

                const { default: MockedClient } = await import(
                    "../../src/Client"
                );

                const room = new Room(new MockedClient(host), 5);

                const message = await room.sendMessage(
                    "This is a test message"
                );

                expect(message.id).toEqual(42);
                expect(message.content).resolves.toEqual(
                    "This is a test message"
                );
            });

            it("Should throw an error for text > 500 chars", async () => {
                expect.assertions(1);

                const room = new Room(client, 5);

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

                const room = new Room(client, 5);

                expect(room.sendMessage("")).rejects.toThrowError(
                    InvalidArgumentError
                );

                //@ts-ignore
                expect(room.sendMessage()).rejects.toThrowError(
                    InvalidArgumentError
                );
            });
        });
    });

    describe("room watching", () => {
        it("Should attempt to watch the room, and attach websockets", async () => {
            expect.assertions(1);

            mockWS({ on: jest.fn() }, "WebSocket");

            const { WebSocket } = await import("ws");

            //@ts-ignore
            const socket = new WebSocket(null);

            const mockWebsocketWatch = jest.fn(() => Promise.resolve(socket));

            mockClient({ watch: mockWebsocketWatch });

            const { default: Client } = await import("../../src/Client");

            const client = new Client("stackoverflow.com");
            const room = new Room(client, 5);

            await room.watch();

            expect(mockWebsocketWatch).toHaveBeenCalledWith(room);
        });

        it("Should correctly process message events", async () => {
            expect.assertions(2);

            //@ts-ignore
            const socket = new WebSocket(null);

            mockBrowser({ watchRoom: () => Promise.resolve(socket) });
            const { default: Browser } = await import("../../src/Browser");

            const client = new Client("stackoverflow.com");
            client.browser = new Browser(client);
            const room = new Room(client, 5);

            const wrappedEvent = { r5: { e: [chatEvent6] } };

            await room.watch();

            const promise = new Promise((r) => room.once("message", r));

            socket.emit("message", JSON.stringify(wrappedEvent));

            await expect(promise).resolves.toBeInstanceOf(Message);
            await expect(promise).resolves.toHaveProperty("id", 44396284);
        });
    });

    describe("room information", () => {
        describe(Room.prototype.listUsers.name, () => {
            it("should correctly list users", async () => {
                expect.assertions(2);

                const host: Host = "stackexchange.com";

                mockClient({
                    listUsers: () =>
                        Promise.resolve([new User(new Client(host), 42)]),
                });

                const { default: MockedClient } = await import(
                    "../../src/Client"
                );

                const room = new Room(new MockedClient(host), 42);

                const users = await room.listUsers();
                expect(users.length).toEqual(1);
                expect(users[0].id).toEqual(42);
            });
        });
    });

    describe("blocking users", () => {
        it("should correctly block users", () => {
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

        it("should unblock users after a timeout if one passed", async () => {
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
        });

        it("should correctly unblock users", () => {
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

        it("should stop passing messages from blocked users", async () => {
            const events = { r42: { e: [{ user_id: 24 }, { user_id: 42 }] } };

            // @ts-ignore
            const socket = new WebSocket(null);

            mockBrowser({ watchRoom: () => Promise.resolve(socket) });
            const { default: Browser } = await import("../../src/Browser");

            const client = new Client("stackexchange.com");
            client.browser = new Browser(client);
            const blockedUserId = 24;

            const room = new Room(client, 42);
            room.block(blockedUserId);
            await room.watch();

            const promise = new Promise<WebsocketEvent>((r) =>
                room.once("message", r)
            );

            socket.emit("message", JSON.stringify(events));

            await expect(promise).resolves.not.toHaveProperty(
                "userId",
                blockedUserId
            );
        });
    });

    describe("ignoring events", () => {
        it("should correctly ignore event types", () => {
            expect.assertions(1);

            const client = new Client("stackoverflow.com");
            const roomId = 42;

            const ignored = ChatEventType.FILE_ADDED;

            const room = new Room(client, roomId);
            room.ignore(ignored);

            expect(room.isIgnored(ignored)).toBe(true);
        });

        it("should correctly unignore event types", () => {
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

        it("should not emit message events for ignored types", async () => {
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

            // @ts-ignore
            const socket = new WebSocket(null);

            mockBrowser({ watchRoom: () => Promise.resolve(socket) })
            const { default: Browser } = await import("../../src/Browser");

            const client = new Client("stackexchange.com");
            client.browser = new Browser(client);

            const room = new Room(client, 42);
            room.ignore(ignored);

            await room.watch();

            const promise = new Promise<WebsocketEvent>((r) =>
                room.on("message", r)
            );

            socket.emit("message", JSON.stringify(events));

            await expect(promise).resolves.toHaveProperty(
                "eventType",
                notIgnored
            );
        });

        it("should ignore all other events if added via Room#only()", () => {
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
});
