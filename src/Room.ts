import { EventEmitter } from "events";
import WebSocket from "ws";
import Client from "./Client";
import InvalidArgumentError from "./Exceptions/InvalidArgumentError";
import Message from "./Message";
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
     * Join a chat room
     *
     * @returns {Promise<boolean>} A promise when the user succesfully joins this room
     * @memberof Room
     */
    public join(): Promise<boolean> {
        this.#isClosing = false;
        return this.#client._browser.joinRoom(this.id);
    }

    /**
     * Leave a chat room
     *
     * @returns {Promise<boolean>} A promise when the user succesfully leaves this room
     * @returns {boolean} Status of leaving the room
     * @memberof Room
     */
    public leave(): Promise<boolean> {
        this.#isClosing = true;
        this.#socket?.close();
        return this.#client._browser.leaveRoom(this.id);
    }

    /**
     * Connects to the chatroom websocket, and watches
     * for new events
     *
     * @returns {Promise<Room>} A promise that completes when the webscocket connection is successfull.
     * @memberof Room
     */
    public async watch(): Promise<Room> {
        const ws = await this.#client._browser.watchRoom(this.id);

        ws.on("message", (rawMsg) => {
            const json = JSON.parse(rawMsg.toString());
            if (
                typeof json[`r${this.id}`] === "undefined" ||
                typeof json[`r${this.id}`].e === "undefined"
            ) {
                return;
            }

            const events: ChatEvent[] = json[`r${this.id}`].e;

            for (const event of events) {
                const msg = new WebsocketEvent(this.#client, event);

                if (this.isIgnored(msg.eventType)) continue;

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
