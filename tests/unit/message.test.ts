import Browser from "../../src/Browser";
import Client, { Host } from "../../src/Client";
import ChatExchangeError from "../../src/Exceptions/ChatExchangeError";
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

    it("Should attempt to get the room ID", async () => {
        expect.assertions(3);

        const getTranscriptMock = jest.fn(() => {
            return Promise.resolve({
                content: "Content",
                edited: false,
                id: 456,
                user: new User(client, 5),
                parentMessageId: 789,
                roomId: 10,
                roomName: "Test",
            });
        });

        class MockBrowser extends Browser {
            getTranscript = getTranscriptMock;
        }

        const client = new Client("stackoverflow.com");
        new MockBrowser(client);

        const msg = new Message(client, 29);

        expect(await msg.roomId).toEqual(10)
        expect(getTranscriptMock).toHaveBeenCalledTimes(1)
        expect(getTranscriptMock).toHaveBeenCalledWith(msg)
    })

    it("Should attempt to send a message", async () => {
        class MockBrowser extends Browser {
            sendMessage = jest.fn();
        }

        const client = new Client("stackoverflow.com");
        const browser = new MockBrowser(client);

        const msg = new Message(client, 29, {
            roomId: 5,
        });

        await msg.reply("Testing");

        expect(browser.sendMessage).toHaveBeenCalledWith(
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

    it("Should throw an error if you attempt to call reply with invalid message id", async () => {
        expect.assertions(1);
        const msg = new Message(new Client("stackoverflow.com"), undefined);

        await expect(msg.reply("A message here")).rejects.toThrowError(ChatExchangeError);
    })

    it('accessing a property on a message should scrape the transcript', async () => {
        const host: Host = "stackoverflow.com";

        const content = "<div class='test'></div>";

        const testClient = new Client(host);

        class MockBrowser extends Browser {
            async getTranscript() {
                return {
                    id: 123,
                    user: new User(testClient, 5),
                    content,
                    roomId: 10,
                    roomName: "room",
                    edited: false,
                    parentMessageId: 42,
                };
            }
        }

        new MockBrowser(testClient);

        const msg = new Message(testClient, 5);
        expect(msg.id).toEqual(5);

        expect(await msg.content).toEqual(content);
        expect(await msg.parentMessageId).toEqual(42);
        expect(await msg.roomId).toEqual(10);
        expect(await msg.user).toHaveProperty('id', 5)
    });
});
