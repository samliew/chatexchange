import { readFile } from "fs/promises";
import WebSocket from "ws";
import Browser from "../../src/Browser";
import Client, { Host } from "../../src/Client";
import InvalidArgumentError from "../../src/Exceptions/InvalidArgumentError";
import Message from "../../src/Message";
import Room from "../../src/Room";

describe("Room", () => {
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

        class MockClient extends Client {
            _browser: Browser = new MockBrowser(this);
        }

        const client = new MockClient(host);
        const room = new Room(client, roomId);

        await room.join();
        await room.leave();

        expect(client._browser.joinRoom).toHaveBeenCalledWith(roomId);
        expect(client._browser.leaveRoom).toHaveBeenCalledWith(roomId);
    });

    it("Should attempt to send a message", async () => {
        expect.assertions(1);

        const roomId = 5;
        const host: Host = "stackoverflow.com";

        class MockBrowser extends Browser {
            sendMessage = jest.fn();
        }

        class MockClient extends Client {
            _browser: Browser = new MockBrowser(this);
        }

        const client = new MockClient(host);
        const room = new Room(client, roomId);

        await room.sendMessage("This is a test message");

        expect(client._browser.sendMessage).lastCalledWith(
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

        expect(room.sendMessage("")).rejects.toThrowError(InvalidArgumentError);

        //@ts-expect-error
        expect(room.sendMessage()).rejects.toThrowError(InvalidArgumentError);
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

        class MockClient extends Client {
            _browser: Browser = new MockBrowser(this);
        }

        const client = new MockClient(host);

        const room = new Room(client, roomId);

        await room.watch();

        expect(mockWebsocketWatch).toHaveBeenCalledWith(roomId);
        expect(mockWebsocketOn).toBeCalledTimes(2);
    });

    it("Should fire an event", async () => {
        expect.assertions(11);

        const roomId = 5;
        const host: Host = "stackoverflow.com";

        //@ts-ignore
        const websocketMock = new WebSocket(null);

        class MockBrowser extends Browser {
            sendMessage = jest.fn();
            leaveRoom = jest.fn();
            watchRoom = jest.fn(() => Promise.resolve(websocketMock));
        }

        class MockClient extends Client {
            _browser: Browser = new MockBrowser(this);
        }

        const client = new MockClient(host);

        const room = new Room(client, roomId);

        const event = JSON.parse(
            await readFile("./tests/events/6.json", { encoding: "utf-8" })
        );

        const wrappedEvent = {
            r5: {
                e: [event],
            },
        };

        const messageSpy = jest.fn();
        const closeSpy = jest.fn();

        room.on("message", messageSpy);
        room.on("close", closeSpy);

        await room.watch();

        websocketMock.emit("message", JSON.stringify(wrappedEvent));
        websocketMock.emit("message", "{}");

        expect(client._browser.watchRoom).toHaveBeenCalledTimes(1);
        expect(client._browser.watchRoom).toHaveBeenCalledWith(roomId);

        // Simulate server disconnect
        websocketMock.emit("close");

        expect(client._browser.watchRoom).toHaveBeenCalledTimes(2);
        expect(client._browser.watchRoom).toHaveBeenCalledWith(roomId);

        expect(messageSpy).toHaveBeenCalledTimes(1);
        expect(closeSpy).toHaveBeenCalledTimes(0);
        expect(client._browser.leaveRoom).toHaveBeenCalledTimes(0);

        await room.leave();

        expect(client._browser.leaveRoom).toHaveBeenCalledWith(roomId);

        websocketMock.emit("close");

        expect(closeSpy).toHaveBeenCalledTimes(1);

        const msg = messageSpy.mock.calls[0][0];

        expect(msg).toBeInstanceOf(Message);
        expect(msg.id).toEqual(44396284);
    });
});