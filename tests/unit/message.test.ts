import Browser from "../../src/Browser";
import Client, { Host } from "../../src/Client";
import Message from "../../src/Message";
import Room from "../../src/Room";
import User from "../../src/User";

describe("Message", () => {
    it("Should create a new message", async () => {
        expect.assertions(3);

        const client = new Client("stackoverflow.com");

        const room = new Room(client, 5);
        const message = new Message(client, 29, {
            roomId: 5,
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
            _browser: Browser = new MockBrowser(this);
        }

        const client = new MockClient("stackoverflow.com");

        const room = new Room(client, 5);
        const msg = new Message(client, 29, {
            roomId: 5,
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
            get parentMessageId() {
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
            get parentMessageId() {
                return Promise.resolve(0);
            }
        }

        const msg = new MockMessage(new Client("stackoverflow.com"), 29);
        const parent = await msg.parent();
        expect(parent).toBeUndefined();
    });

    it('"_scrapeTranscript" should set the properties from transript', async () => {
        const host: Host = "stackoverflow.com";

        const content = "<div class='test'></div>";

        const testClient = new Client(host);

        class MockBrowser extends Browser {
            async getTranscript() {
                return {
                    id: 123,
                    user: new User(testClient, 5),
                    content,
                    roomId: 5,
                    roomName: "room",
                    edited: false,
                    parentMessageId: 42,
                };
            }
        }

        const client = {
            _browser: new MockBrowser(testClient),
        } as unknown as Client;

        const msg = new Message(client, 5);

        //@ts-expect-error
        await msg._scrapeTranscript();

        expect(await msg.id).toEqual(5);
        expect(await msg.content).toEqual(content);
    });
});
