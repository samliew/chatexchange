import { validate } from "email-validator";
import Browser, { IProfileData } from "./Browser";
import ChatExchangeError from "./Exceptions/ChatExchangeError";
import InvalidArgumentError from "./Exceptions/InvalidArgumentError";
import Message from "./Message";
import Room from "./Room";
import User from "./User";
import { delay } from "./utils";

export type Host =
    | "stackexchange.com"
    | "meta.stackexchange.com"
    | "stackoverflow.com";

export const AllowedHosts: Host[] = [
    "stackexchange.com",
    "meta.stackexchange.com",
    "stackoverflow.com",
];

/**
 * Represents the main chatexchange Client class.
 * @class
 */
export class Client {
    /* @internal */
    public _browser: Browser;

    #rooms = new Map<number, Room>();
    #users = new Map<number, User>();

    /**
     * Creates an instance of Client.
     *
     * @param {string} host The host to connect to (stackexchange.com, meta.stackexchange.com, or stackoverflow.com)
     * @throws {InvalidArgumentError} If the host is invalid
     * @constructor
     */
    constructor(public readonly host: Host) {
        if (!AllowedHosts.includes(host)) {
            throw new InvalidArgumentError(
                `Invalid host. Must be one of ${AllowedHosts.join(", ")}`
            );
        }

        this._browser = new Browser(this);
    }

    /**
     * @summary Returns the chat host URL
     * @returns {string}
     * @memberof Client#
     */
    public get root(): string {
        const { host } = this;
        return `https://chat.${host}/`;
    }

    /**
     * @summary gets user chat fkey
     * @returns {Promise<string>}
     * @memberof Client#
     */
    public get fkey(): Promise<string> {
        const { _browser } = this;
        return _browser.chatFKey;
    }

    /**
     * Fetches the current logged-in user's profile
     *
     * @returns {Promise<User>} The user object
     * @throws {ChatExchangeError} If no user is currently logged in
     * @memberof Client
     */
    public async getMe(): Promise<User> {
        if (!this._browser.loggedIn) {
            throw new ChatExchangeError("Cannot get user, not logged in.");
        }

        return new User(this, await this._browser.userId);
    }

    public getMessage(id: number): Message {
        // eslint-disable-line class-methods-use-this
        // Add caching in the future?
        return new Message(this, id);
    }

    public getRooms(): Map<number, Room> {
        return this.#rooms;
    }

    public getRoomsAsArray(): Room[] {
        return [...this.#rooms.values()];
    }

    public getRoom(id: number): Room {
        let room = this.#rooms.get(id);
        if (room) {
            return room;
        }

        room = new Room(this, id);

        this.#rooms.set(id, room);

        return room;
    }

    public getUser(
        id: number,
        existingData?: Omit<Partial<IProfileData>, "id"> | undefined
    ): User {
        let user = this.#users.get(id);
        if (user) {
            return user;
        }

        user = new User(this, id, existingData);

        this.#users.set(id, user);

        return user;
    }

    /**
     * Attempts to login to the stackexchange network
     * with the provided username and password
     *
     * @param {string} email Email
     * @param {string} password Password
     * @returns {Promise<string>} Request Cookie Jar (Optionally to save to `loginCookie`)
     * @memberof Client
     */
    public async login(email: string, password: string): Promise<string> {
        if (!password) {
            throw new InvalidArgumentError("Email and password are required.");
        }

        if (!validate(email)) throw new InvalidArgumentError("Invalid email");

        const result = await this._browser.login(email, password);

        return result;
    }

    /**
     * Attempts to login to stack exchange, using the provided
     * cookie jar string, which was retrieved from the `login`
     * method.
     *
     * @param {string} cookieString A cookie jar string
     * @returns {Promise<void>} A promise representing when login is complete
     * @memberof Client
     */
    public async loginCookie(cookieString: string): Promise<void> {
        if (typeof cookieString !== "string" || cookieString === "") {
            throw new InvalidArgumentError("cookieString is required.");
        }

        await this._browser.loginCookie(cookieString);
    }

    /**
     * Joins a room, and returns the room object
     *
     * @param {number} id The ID of the room to join
     * @returns {Promise<Room>} The room object
     * @memberof Client
     */
    public async joinRoom(id: number): Promise<Room> {
        const room = this.getRoom(id);

        await room.join();

        return room;
    }

    /**
     * Leaves a room
     *
     * @returns {Promise<boolean>}
     * @memberof Client
     */
    public leaveRoom(id: number): Promise<boolean> {
        return this._browser.leaveRoom(id);
    }

    /**
     * Leaves all rooms (on same chat server)
     *
     * @returns {Promise<boolean>}
     * @memberof Client
     */
    public leaveAll(): Promise<boolean> {
        return this._browser.leaveAllRooms();
    }

    /**
     * Broadcasts a message to all joined rooms
     * @param message message to broadcast
     */
    public async broadcast(message: string): Promise<Map<number, boolean>> {
        const rooms = this.#rooms;

        const statusMap: Map<number, boolean> = new Map();

        let throttled = false;
        for (const [roomId, room] of rooms) {
            try {
                await room.sendMessage(message);

                statusMap.set(roomId, true);

                // second message can be sent immediately
                // https://meta.stackexchange.com/a/167749/786798
                if (throttled) {
                    // respect the stated delay between messages
                    // https://meta.stackexchange.com/a/164900/786798
                    await delay(1e3 + 4);

                    throttled = false;
                    continue;
                }

                throttled = true;
            } catch (error) {
                statusMap.set(roomId, false);
            }
        }

        return statusMap;
    }
}

export default Client;
