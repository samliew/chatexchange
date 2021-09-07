import { EventEmitter } from "events";
import WebSocket from "ws";
import Client from "./Client";
import InvalidArgumentError from "./Exceptions/InvalidArgumentError";
import Message from "./Message";
import WebsocketEvent, { ChatEvent } from "./WebsocketEvent";

/* eslint-disable no-underscore-dangle */
/**
 * Represents a chatroom
 *
 * @extends {EventEmitter}
 */
class Room extends EventEmitter {
    /**
     * The id of the room
     *
     * @type {number}
     * @memberof Room
     */
    public id: number;
    #client: Client;
    #isClosing: boolean = false;

    #socket?: WebSocket;

    /**
     * Creates an instance of Room.
     *
     * @param {Client} client The Client instance
     * @param {number} id The id of the room
     * @memberof Room
     */
    constructor(client: Client, id: number) {
        super();
        this.#client = client;
        this.id = id;
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
