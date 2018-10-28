import { EventEmitter } from 'events';
import Message from './Message';
import InvalidArgumentError from './Exceptions/InvalidArgumentError';

/* eslint-disable no-underscore-dangle */
/**
 * Represents a chatroom
 *
 * @class Room
 * @extends {EventEmitter}
 */
class Room extends EventEmitter {
    constructor(client, id) {
        super();
        this._client = client;
        this.id = id;
    }

    /**
     * Join a chat room
     * 
     * @returns {Promise<void>} A promise when the user succesfully joins this room
     * @memberof Room
     */
    async join() {
        await this._client._browser.joinRoom(this.id);
    }

    /**
     * Connects to the chatroom websocket, and watches
     * for new events
     *
     * @returns {Promise<void>} A promise that completes when the webscocket connection is successfull.
     * @memberof Room
     */
    async watch() {
        const ws = await this._client._browser.watchRoom(this.id);

        ws.on('message', msg => {
            const json = JSON.parse(msg);
            if (typeof json[`r${this.id}`] === 'undefined' ||
                typeof json[`r${this.id}`].e === 'undefined') {
                return;
            }

            const events = json[`r${this.id}`].e;

            for (const event of events) {
                this.emit('message', new Message(this, event.message_id, event));
            }
        });

        ws.on('close', () => {
            console.log('Disconnected');
        });
    }

    /**
     * Sends a message to this room
     *
     * @param {string} message The message to send
     * @throws {InvalidArgumentError} If `content` > 500 character, empty, or isn't a string.
     * @returns {Promise<void>} A promise that completes when the message has been sent
     * @memberof Room
     */
    sendMessage(message) {
        if (typeof message !== 'string') {
            throw new InvalidArgumentError('Message should be a string.');
        }
        if (message.length > 500) {
            throw new InvalidArgumentError('Unable to send message because it was longer than 500 characters.');
        }
        if (message.length === 0) {
            throw new InvalidArgumentError('Unable to send message because it was empty.');
        }

        return this._client._browser.sendMessage(this.id, message);
    }
}

export default Room;
