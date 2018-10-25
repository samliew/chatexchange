import { EventEmitter } from 'events';
import Message from './Message';

/* eslint-disable no-underscore-dangle */
class Room extends EventEmitter {
    constructor(client, id) {
        super();
        this._client = client;
        this.id = id;
    }

    async join() {
        await this._client._browser.joinRoom(this.id);
    }

    async watch() {
        const ws = await this._client._browser.watchRoom(this.id);

        ws.on('message', msg => {
            const json = JSON.parse(msg);
            if (typeof json[`r${this.id}`] === 'undefined' ||
                typeof json[`r${this.id}`].e === 'undefined') {
                return;
            }

            const events = json[`r${this.id}`].e;

            console.log(events);

            for (const event of events) {
                this.emit('message', new Message(this, event));
            }
        });

        ws.on('close', () => {
            console.log('Disconnected');
        });
    }

    sendMessage(content) {
        if (content.length > 500) {
            throw new Error('Unable to send message because it was longer than 500 characters.');
        }

        if (content.length === 0) {
            throw new Error('Unable to send message because it was empty.');
        }

        return this._client._browser.sendMessage(this.id, content);
    }
}

export default Room;