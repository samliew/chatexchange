import Client from "./Client";
import Room from "./Room";
import { lazy } from "./utils";

/**
 * Represents a message that was sent in a chatroom
 *
 * @class
 */
class Message {
    public id: number;
    private _client: Client;
    private _eventId?: number;
    private _eventType?: string;
    private _content?: string;
    private _userId?: number;
    private _targetUserId?: number;
    private _roomId?: number;
    private _room?: Room;
    private _roomName?: string;
    private _userName?: string;
    private _parentId?: number;

    /**
     * Creates an instance of Message.
     *
     * @param {Client} client The client associated with this message
     * @param {number} id The ID of the message
     * @param {Object} attrs Extra attributes that should be assigned to this message
     * @constructor
     */
    constructor(client: Client, id: number, attrs: {[key: string]: any} = {}) {
        this._client = client;
        this.id = id;
        this._eventId = attrs.id;
        this._eventType = attrs.event_type;
        this._content = attrs.content;
        this._userId = attrs.user_id;
        this._targetUserId = attrs.target_user_id;
        this._roomId = attrs.roomId;
        this._room = attrs.room;
        this._roomName = attrs.roomName;
        this._userName = attrs.user_name;
        this._parentId = attrs.parent_id;
    }

    get room(): Promise<Room> {
        return lazy<Room>(() => this._room, () => this._setRoom());
    }

    get roomId(): Promise<number> {
        return lazy<number>(() => this._roomId, () => this._scrapeTranscript());
    }

    get content(): Promise<string> {
        return lazy<string>(() => this._content, () => this._scrapeTranscript());
    }

    get userId(): Promise<number> {
        return lazy<number>(() => this._userId, () => this._scrapeTranscript());
    }

    get targetUserId(): Promise<number> {
        return lazy<number>(() => this._targetUserId, () => this._scrapeTranscript());
    }

    get parentId(): Promise<number> {
        return lazy<number>(() => this._parentId, () => this._scrapeTranscript());
    }

    public async _setRoom() {
        const roomId = await this.roomId;

        this._room = this._client.getRoom(roomId);
    }

    public async _scrapeTranscript() {
        const data = await this._client._browser.getTranscript(this.id);

        for (const [key, value] of Object.entries(data)) {
            this[`_${key}`] = value;
        }
    }

    /**
     * Send a reply to this message, replying to the user
     * (This will ping the user)
     *
     * @param {string} message The message to send
     * @returns {Promise<Message>} A promise that contains the Message object that was sent
     * @throws {InvalidArgumentError} If message > 500 character, empty, or isn't a string.
     * @memberof Message
     */
    public async reply(message: string): Promise<Message> {
        const room = await this.room;

        const res = await room.sendMessage(`:${this.id} ${message}`);

        return res;
    }

    /**
     * Fetches the parent message from this message, or undefined
     * if there is no message
     *
     * @returns {Promise<Message|undefined>} Promise
     * @memberof Message
     */
    public async parent(): Promise<Message | undefined> {
        const parentId = await this.parentId;

        if (parentId) {
            return new Message(this._client, parentId);
        }
    }
}

export default Message;
