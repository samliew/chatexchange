import Message from '../../src/Message';
import Room from '../../src/Room';

describe('Message', () => {
    it('Should create a new message', () => {
        const room = new Room(null, 5);
        const message = new Message(room, 29, {});

        expect(message.id).toEqual(29);
        expect(room).toBeTruthy();
    });

    it('Should attempt to send a message', async () => {
        expect.assertions(1);
        const client = {
            _browser: {
                sendMessage: jest.fn()
            }
        };

        const room = new Room(client, 5);
        const msg = new Message(room, 29, {});

        await msg.reply('Testing');

        expect(client._browser.sendMessage).toHaveBeenCalledWith(5, ':29 Testing');
    });
})
