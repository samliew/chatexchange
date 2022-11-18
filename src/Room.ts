import { EventEmitter } from "events";
import type WebSocket from "ws";
import { DeleteMessageStatus, type IRoomSave } from "./Browser.js";
import type Client from "./Client";
import InvalidArgumentError from "./Exceptions/InvalidArgumentError";
import Message from "./Message";
import User from "./User";
import { delay } from "./utils";
import { ChatEventType } from "./WebsocketEvent";

/* eslint-disable no-underscore-dangle */
/**
 * Represents a chatroom
 *
 * @extends {EventEmitter}
 */
class Room extends EventEmitter {
    #client: Client;

    #socket?: WebSocket;
    #ignored: Set<ChatEventType> = new Set();
    #blocked: Map<number, number> = new Map();

    leaving = false;

    /**
     * Creates an instance of Room.
     *
     * @param {Client} client The Client instance
     * @param {number} id The id of the room
     * @memberof Room
     */
    constructor(client: Client, public id: number) {
        super();
        this.#client = client;
    }

    /**
     * @summary returns the room's transcript URL
     */
    get transcriptURL(): string {
        const { host } = this.#client;
        const { id } = this;
        return `https://chat.${host}/transcript/${id}`;
    }

    /**
     * @summary attempts to update the room
     * @param config {@link Room} configuration options
     */
    public async update(config: Omit<IRoomSave, "host">): Promise<boolean> {
        try {
            await this.#client.updateRoom(this, config);
            return true;
        } catch (error) {
            console.error(error);
            return false;
        }
    }

    /**
     * Blocks a user for a given amount of time (or forever)
     *
     * @param user user to block
     * @param howLong how long to block the user (in seconds)
     * @returns {void}
     * @memberof Room
     */
    public block(user: number | User, howLong = Infinity): void {
        const uid = typeof user === "number" ? user : user.id;
        this.#blocked.set(uid, howLong);

        if (howLong < Infinity) {
            delay(howLong * 1e3).then(() => this.unblock(uid));
        }
    }

    /**
     * Unblocks users
     *
     * @param users users to unblock
     * @returns {void}
     * @memberof Room
     */
    public unblock(...users: (number | User)[]): void {
        users.forEach((u) => {
            const uid = typeof u === "number" ? u : u.id;
            this.#blocked.delete(uid);
        });
    }

    /**
     * Checks if a user is blocked
     *
     * @param user user to check
     * @returns {boolean}
     * @memberof Room
     */
    public isBlocked(user: number | User): boolean {
        const uid = typeof user === "number" ? user : user.id;
        return this.#blocked.has(uid);
    }

    /**
     * Adds a chat event type to the list of ignored types
     *
     * @param {...ChatEventType} eventType event type
     * @returns {void}
     * @memberof Room
     */
    public ignore(...eventType: ChatEventType[]): void {
        eventType.forEach((type) => {
            this.#ignored.add(type);
        });
    }

    /**
     * Removes an event type from the list of ignored types
     *
     * @param {...ChatEventType} eventType event type
     * @returns {void}
     * @memberof Room
     */
    public unignore(...eventType: ChatEventType[]): void {
        eventType.forEach((type) => {
            this.#ignored.delete(type);
        });
    }

    /**
     * Checks if an event type is ignored
     *
     * @param {ChatEventType} eventType event type
     * @returns {boolean}
     * @memberof Room
     */
    public isIgnored(eventType: ChatEventType): boolean {
        return this.#ignored.has(eventType);
    }

    /**
     * @summary exclusively subscribes to a list of events
     * @param eventType event type
     */
    public only(...eventType: ChatEventType[]): void {
        const allow = new Set(eventType);

        const ignore = Object.values(ChatEventType).filter(
            (v) => !allow.has(v as ChatEventType)
        );

        return this.ignore(...(ignore as ChatEventType[]));
    }

    /**
     * @summary Join a chat room
     * @returns {Promise<boolean>} A promise when the user succesfully joins this room
     * @memberof Room#
     */
    public join(): Promise<boolean> {
        this.leaving = false;
        return this.#client.joinRoom(this);
    }

    /**
     * @summary Leave a chat room
     * @returns {Promise<boolean>} A promise when the user succesfully leaves this room
     * @memberof Room#
     */
    public leave(): Promise<boolean> {
        this.leaving = true;
        this.#socket?.close();
        return this.#client.leaveRoom(this);
    }

    /**
     * Connects to the chatroom websocket, and watches
     * for new events
     *
     * @returns {Promise<Room>} A promise that completes when the webscocket connection is successfull.
     * @memberof Room
     */
    public async watch(): Promise<Room> {
        this.#socket = await this.#client.watch(this);
        return this;
    }

    /**
     * @summary deletes a given message
     * @param message {@link Message} or ID to delete
     */
    public async delete(
        message: number | Message
    ): Promise<DeleteMessageStatus> {
        return this.#client.delete(message);
    }

    /**
     * @summary returns a list of users currently in the room
     */
    public async listUsers(): Promise<User[]> {
        return this.#client.listUsers(this);
    }

    /**
     * @summary Sends a message to this room
     * @param message The message to send
     * @throws {InvalidArgumentError} If `content` > 500 character, empty, or isn't a string.
     * @returns {Promise<Message>} A promise with the message that was sent
     * @memberof Room#
     */
    public async sendMessage(message: string): Promise<Message> {
        if (typeof message !== "string") {
            throw new InvalidArgumentError("Message should be a string.");
        }
        if (message.length > 500) {
            throw new InvalidArgumentError(
                "Unable to send message because it was longer than 500 characters."
            );
        }
        if (message.length === 0) {
            throw new InvalidArgumentError(
                "Unable to send message because it was empty."
            );
        }

        const [, msg] = await this.#client.send(message, this);

        return msg;
    }
}

export default Room;
