import Room from '../dist/Room';
import InvalidArgumentError from '../dist/Exceptions/InvalidArgumentError';

describe('Room', () => {
    it('Should create a room with id', () => {
        const room = new Room(null, 5);

        expect(room.id).toEqual(5);
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

        var client = {
            _browser: {
                sendMessage: jest.fn()
            }
        };

        const room = new Room(client, 5);

        expect(() => 
            room.sendMessage(`
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean aliquet auctor sem, luctus sodales orci egestas id. 
                Nullam sit amet mi turpis. Etiam nec nibh id dolor semper imperdiet ut vitae odio. Vestibulum sagittis est sed augue euismod finibus. 
                Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Integer in dui non lectus pellentesque porta 
                sit amet vitae est. In blandit felis non sapien consectetur egestas. Proin ac dignissim lectus. In hac massa nunc.`)
        ).toThrowError(InvalidArgumentError);
    })
})