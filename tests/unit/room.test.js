import fs from 'fs';
import { EventEmitter } from 'events';
import Room from '../../src/Room';
import InvalidArgumentError from '../../src/Exceptions/InvalidArgumentError';
import { delay } from '../../src/utils';
import Message from '../../src/Message';

describe('Room', () => {
    it('Should create a room with id', () => {
        const room = new Room(null, 5);

        expect(room.id).toEqual(5);
    });

    it('Should attempt to join/leave a room', async () => {
        expect.assertions(2);

        var client = {
            _browser: {
                joinRoom: jest.fn(),
                leaveRoom: jest.fn()
            }
        };

        const room = new Room(client, 5);

        await room.join();
        await room.leave();

        expect(client._browser.joinRoom).toHaveBeenCalledWith(5);
        expect(client._browser.leaveRoom).toHaveBeenCalledWith(5);
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

        expect(room.sendMessage(`
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean aliquet auctor sem, luctus sodales orci egestas id. 
                Nullam sit amet mi turpis. Etiam nec nibh id dolor semper imperdiet ut vitae odio. Vestibulum sagittis est sed augue euismod finibus. 
                Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Integer in dui non lectus pellentesque porta 
                sit amet vitae est. In blandit felis non sapien consectetur egestas. Proin ac dignissim lectus. In hac massa nunc.`)
        ).rejects.toThrowError(InvalidArgumentError);
    });

    it('Should throw an error for text is empty', async () => {
        expect.assertions(2);

        const room = new Room(null, 5);

        expect(room.sendMessage('')).rejects.toThrowError(InvalidArgumentError);

        
        expect(room.sendMessage()).rejects.toThrowError(InvalidArgumentError);
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

    it('Should fire an event', async () => {
        expect.assertions(11);

        const websocketMock = new EventEmitter();

        const client = {
            _browser: {
                sendMessage: jest.fn(),
                leaveRoom: jest.fn(),
                watchRoom: jest.fn(() => websocketMock)
            }
        };

        const room = new Room(client, 5);

        const event = JSON.parse(fs.readFileSync('./tests/events/6.json').toString('utf8'));

        const wrappedEvent = {
            r5: {
                e: [event]
            }
        };

        const messageSpy = jest.fn();
        const closeSpy = jest.fn();

        room.on('message', messageSpy);
        room.on('close', closeSpy);

        await room.watch();

        websocketMock.emit('message', JSON.stringify(wrappedEvent));
        websocketMock.emit('message', '{}');
        
        expect(client._browser.watchRoom).toHaveBeenCalledTimes(1);
        expect(client._browser.watchRoom).toHaveBeenCalledWith(5);

        // Simulate server disconnect
        websocketMock.emit('close');

        expect(client._browser.watchRoom).toHaveBeenCalledTimes(2);
        expect(client._browser.watchRoom).toHaveBeenCalledWith(5);

        expect(messageSpy).toHaveBeenCalledTimes(1);
        expect(closeSpy).toHaveBeenCalledTimes(0);
        expect(client._browser.leaveRoom).toHaveBeenCalledTimes(0);

        await room.leave();

        expect(client._browser.leaveRoom).toHaveBeenCalledWith(5);

        websocketMock.emit('close');
        
        expect(closeSpy).toHaveBeenCalledTimes(1);

        const msg = messageSpy.mock.calls[0][0];

        expect(msg).toBeInstanceOf(Message);
        expect(msg.id).toEqual(44396284);
    });
})
