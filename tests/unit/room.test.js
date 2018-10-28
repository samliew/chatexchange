import Room from '../../src/Room';
import InvalidArgumentError from '../../src/Exceptions/InvalidArgumentError';

describe('Room', () => {
    it('Should create a room with id', () => {
        const room = new Room(null, 5);

        expect(room.id).toEqual(5);
    });

    it('Should attempt to join a room', async () => {
        expect.assertions(1);

        var client = {
            _browser: {
                joinRoom: jest.fn()
            }
        };

        const room = new Room(client, 5);

        await room.join();

        expect(client._browser.joinRoom).toHaveBeenCalledWith(5);
    });

    it('Should attempt to send a message', async () => {
        expect.assertions(1);

        var client = {
            _browser: {
                sendMessage: jest.fn()
            }
        };

        const room = new Room(client, 5);

        await room.sendMessage('This is a test message');

        expect(client._browser.sendMessage).lastCalledWith(5, 'This is a test message');
    });

    it('Should throw an error for text > 500 chars', async () => {
        expect.assertions(1);

        const room = new Room(null, 5);

        expect(() => 
            room.sendMessage(`
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean aliquet auctor sem, luctus sodales orci egestas id. 
                Nullam sit amet mi turpis. Etiam nec nibh id dolor semper imperdiet ut vitae odio. Vestibulum sagittis est sed augue euismod finibus. 
                Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Integer in dui non lectus pellentesque porta 
                sit amet vitae est. In blandit felis non sapien consectetur egestas. Proin ac dignissim lectus. In hac massa nunc.`)
        ).toThrowError(InvalidArgumentError);
    });

    it('Should throw an error for text is empty', async () => {
        expect.assertions(2);

        const room = new Room(null, 5);

        expect(() => 
            room.sendMessage('')
        ).toThrowError(InvalidArgumentError);

        
        expect(() => 
            room.sendMessage()
        ).toThrowError(InvalidArgumentError);
    });

    it('Should attempt to watch the room, and attach websockets', async () => {
        expect.assertions(2);

        const mockWebsocketOn = jest.fn();

        const mockWebsocket = jest.fn(() => ({
            on: mockWebsocketOn,
        }));

        var client = {
            _browser: {
                watchRoom: jest.fn(() => mockWebsocket())
            }
        };

        const room = new Room(client, 5);

        await room.watch();

        expect(client._browser.watchRoom).toHaveBeenCalledWith(5);
        expect(mockWebsocketOn).toBeCalledTimes(2);
    });
})
