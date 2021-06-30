import { ITranscriptData } from "./Browser";
import Client from "./Client";
import ChatExchangeError from "./Exceptions/ChatExchangeError";
import Room from "./Room";
import User from "./User";
import { lazy } from "./utils";

//allows the use of string indexes without assertions
interface Message {
    [x: string]: unknown;
}

/**
 * Represents a message that was sent in a chatroom
 * @class
 */
class Message {
    /**
     * The message ID. If this is a WebsocketEvent Message, if the message is
     * not a message type, this will be undefined
     *
     * @type {(number | undefined)}
     * @memberof Message
     */
    public id: number | undefined;
    #client: Client;
    #room: Room | undefined;
    #transcriptData?: Partial<ITranscriptData>;

    /**
     * @summary Creates an instance of Message.
     * @param {Client} client The client associated with this message
     * @param {number} id The ID of the message
     * @param {Partial<ITranscriptData>} attrs Extra attributes that should be assigned to this message
     * @constructor
     */
    constructor(
        client: Client,
        id: number | undefined,
        attrs: Partial<ITranscriptData> = {}
    ) {
        this.#client = client;
        this.id = id;
        this.#transcriptData = attrs;
    }

    /**
     * The room associated with this message
     *
     * @readonly
     * @type {Promise<Room>}
     * @memberof Message
     */
    get room(): Promise<Room> {
        return lazy<Room>(
            () => this.#room,
            /* istanbul ignore next */
            () => this._setRoom()
        );
    }

    /**
     * The room ID associated with this message
     *
     * @readonly
     * @type {Promise<number>}
     * @memberof Message
     */
    get roomId(): Promise<number> {
        return lazy<number>(
            () => this.#transcriptData?.roomId,
            () => this._scrapeTranscript()
        );
    }

    /**
     * The actual text content of the message. This will be raw HTML as
     * parsed by the server
     *
     * @readonly
     * @type {Promise<string>}
     * @memberof Message
     */
    get content(): Promise<string> {
        return lazy<string>(
            () => this.#transcriptData?.content,
            /* istanbul ignore next */
            () => this._scrapeTranscript()
        );
    }

    /**
     * The user associated with this message
     *
     * @readonly
     * @type {Promise<User>}
     * @memberof Message
     */
    get user(): Promise<User> {
        return lazy<User>(
            () => this.#transcriptData?.user,
            /* istanbul ignore next */
            () => this._scrapeTranscript()
        );
    }

    get parentMessageId(): Promise<number> {
        return lazy<number>(
            () => this.#transcriptData?.parentMessageId,
            /* istanbul ignore next */
            () => this._scrapeTranscript()
        );
    }

    private async _setRoom() {
        const roomId = await this.roomId;

        this.#room = this.#client.getRoom(roomId);
    }

    private async _scrapeTranscript(): Promise<void> {
        if (!this.id) {
            throw new ChatExchangeError("This is not a valid message.");
        }

        this.#transcriptData = await this.#client._browser.getTranscript(this.id);
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
        if (!this.id) {
            throw new ChatExchangeError("This is not a valid message that can be replied to.");
        }

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
        const parentId = await this.parentMessageId;

        //TODO: rethink - is 0 really the best option when no parent is present?
        if (parentId) {
            return new Message(this.#client, parentId);
        }
    }
}

export default Message;
