import Message from '../../src/Message';
import Room from '../../src/Room';

describe('Message', () => {
    it('Should create a new message', async () => {
        expect.assertions(3);

        const room = new Room(null, 5);
        const message = new Message(null, 29, {
            roomId: 5,
            room,
        });

        expect(message.id).toEqual(29);
        expect(await message.roomId).toEqual(5);
        expect(await message.room).toEqual(room);
    });

    it('Should attempt to send a message', async () => {
        expect.assertions(1);
        const client = {
            _browser: {
                sendMessage: jest.fn()
            }
        };

        const room = new Room(client, 5);
        const msg = new Message(client, 29, {
            roomId: 5,
            room: room,
        });

        await msg.reply('Testing');

        expect(client._browser.sendMessage).toHaveBeenCalledWith(5, ':29 Testing');
    });
})
