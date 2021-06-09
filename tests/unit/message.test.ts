import Browser from "../../src/Browser";
import Client, { Host } from "../../src/Client";
import Message from "../../src/Message";
import Room from "../../src/Room";

describe("Message", () => {
    it("Should create a new message", async () => {
        expect.assertions(3);

        const client = new Client("stackoverflow.com");

        const room = new Room(client, 5);
        const message = new Message(client, 29, {
            roomId: 5,
            room,
        });

        expect(message.id).toEqual(29);
        expect(await message.roomId).toEqual(5);
        expect(await message.room).toEqual(room);
    });

    it("Should attempt to send a message", async () => {
        class MockBrowser extends Browser {
            sendMessage = jest.fn();
        }

        class MockClient extends Client {
            _browser: Browser = new MockBrowser(this, "stackoverflow.com");
        }

        const client = new MockClient("stackoverflow.com");

        const room = new Room(client, 5);
        const msg = new Message(client, 29, {
            roomId: 5,
            room: room,
        });

        await msg.reply("Testing");

        expect(client._browser.sendMessage).toHaveBeenCalledWith(
            5,
            ":29 Testing"
        );
    });

    it("Should return parent message if parentId is set", async () => {
        const parentId = 42;

        class MockMessage extends Message {
            get parentId() {
                return Promise.resolve(parentId);
            }
        }

        const msg = new MockMessage(new Client("stackoverflow.com"), 29);

        const parent = await msg.parent();
        expect(parent).toBeInstanceOf(Message);
        expect(parent!.id).toEqual(parentId);
    });

    it("Should return undfined if 'parentId' is not set", async () => {
        class MockMessage extends Message {
            get parentId() {
                return Promise.resolve(0);
            }
        }

        const msg = new MockMessage(new Client("stackoverflow.com"), 29);
        const parent = await msg.parent();
        expect(parent).toBeUndefined();
    });

    it("Should lazy-get properties correctly", async () => {
        const content = "<div class='test'></div>";

        class MockMessage extends Message {
            async _scrapeTranscript() {
                this["_content"] = content;
                this["_parentId"] = 42;
                this["_userId"] = 123456;
                this["_targetUserId"] = 5;
            }
        }

        const msg = new MockMessage(new Client("stackoverflow.com"), 29);

        expect(await msg.parentId).toEqual(42);
        expect(await msg.targetUserId).toEqual(5);
        expect(await msg.userId).toEqual(123456);
        expect(await msg.content).toEqual(content);
    });

    it('"_scrapeTranscript" should set the properties from transript', async () => {
        const host: Host = "stackoverflow.com";

        class MockBrowser extends Browser {
            async getTranscript() {
                return {
                    content: "",
                    edited: false,
                    id: 123,
                    msgId: 5,
                    parentMessageId: 42,
                    roomId: 5,
                    roomName: "room",
                };
            }
        }

        const client = {
            _browser: new MockBrowser(new Client(host), host),
        } as unknown as Client;

        const msg = new Message(client, 5);

        await msg._scrapeTranscript();

        expect(msg["_roomId"]).toEqual(5);
        expect(msg["_roomName"]).toEqual("room");
    });
});
