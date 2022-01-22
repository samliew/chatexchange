import { EventEmitter } from "events";
import WebSocket from "ws";
import Client from "./Client";
import InvalidArgumentError from "./Exceptions/InvalidArgumentError";
import Message from "./Message";
import User from "./User";
import { delay } from "./utils";
import WebsocketEvent, { ChatEvent, ChatEventType } from "./WebsocketEvent";

/* eslint-disable no-underscore-dangle */
/**
 * Represents a chatroom
 *
 * @extends {EventEmitter}
 */
class Room extends EventEmitter {
    #client: Client;
    #isClosing: boolean = false;

    #socket?: WebSocket;
    #ignored: Set<ChatEventType> = new Set();
    #blocked: Map<number, number> = new Map();

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

        const ignore = Object
            .values(ChatEventType)
            .filter((v) => !allow.has(v as ChatEventType));

        return this.ignore(...ignore as ChatEventType[]);
    }

    /**
     * @summary Join a chat room
     * @returns {Promise<boolean>} A promise when the user succesfully joins this room
     * @memberof Room#
     */
    public join(): Promise<boolean> {
        this.#isClosing = false;
        return this.#client._browser.joinRoom(this);
    }

    /**
     * @summary Leave a chat room
     * @returns {Promise<boolean>} A promise when the user succesfully leaves this room
     * @memberof Room#
     */
    public leave(): Promise<boolean> {
        this.#isClosing = true;
        this.#socket?.close();
        return this.#client._browser.leaveRoom(this);
    }

    /**
     * Connects to the chatroom websocket, and watches
     * for new events
     *
     * @returns {Promise<Room>} A promise that completes when the webscocket connection is successfull.
     * @memberof Room
     */
    public async watch(): Promise<Room> {
        const ws = await this.#client._browser.watchRoom(this);

        ws.on("message", (rawMsg) => {
            const json = JSON.parse(rawMsg.toString());
            if (typeof json[`r${this.id}`]?.e === "undefined") {
                return;
            }

            const events: ChatEvent[] = json[`r${this.id}`].e;

            for (const event of events) {
                const msg = new WebsocketEvent(this.#client, event);

                const skipRules = [
                    this.isIgnored(msg.eventType),
                    msg.userId && this.isBlocked(msg.userId),
                ];

                if (skipRules.some(Boolean)) continue;

                this.emit("message", msg);
            }
        });

        ws.on("close", () => {
            if (this.#isClosing) {
                this.emit("close");
            } else {
                ws.removeAllListeners();
                this.watch();
            }
        });

        this.#socket = ws;
        return this;
    }

    /**
     * Sends a message to this room
     *
     * @param {string} message The message to send
     * @throws {InvalidArgumentError} If `content` > 500 character, empty, or isn't a string.
     * @returns {Promise<Message>} A promise with the message that was sent
     * @memberof Room
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

        const res = await this.#client._browser.sendMessage(this.id, message);

        return res;
    }
}

export default Room;
