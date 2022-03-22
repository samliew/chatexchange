import { validate } from "email-validator";
import Browser, { type IProfileData, type ITranscriptData } from "./Browser";
import ChatExchangeError from "./Exceptions/ChatExchangeError";
import InvalidArgumentError from "./Exceptions/InvalidArgumentError";
import Message from "./Message";
import Room from "./Room";
import User from "./User";
import { delay } from "./utils";
import WebsocketEvent, { type ChatEvent } from "./WebsocketEvent";

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

    #browser: Browser;
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

        this.#browser = new Browser(this);
    }

    /**
     * @summary swaps out the internal {@link Browser} instance
     * @param browser instance of {@link Browser} to swap with
     */
    public set browser(browser: Browser) {
        this.#browser = browser;
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
        return this.#browser.chatFKey;
    }

    /**
     * Fetches the current logged-in user's profile
     *
     * @returns {Promise<User>} The user object
     * @throws {ChatExchangeError} If no user is currently logged in
     * @memberof Client#
     */
    public async getMe(): Promise<User> {
        const browser = this.#browser;

        if (!browser.loggedIn) {
            throw new ChatExchangeError("Cannot get user, not logged in.");
        }

        return new User(this, await browser.userId);
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

    /**
     * @summary gets the chat profile of a given {@link User}
     * @param user user or user ID to get the chat profile of
     */
    public getProfile(user: number | User): Promise<IProfileData> {
        const browser = this.#browser;
        return browser.getProfile(user);
    }

    /**
     * @summary gets a {@link Room} instance from the client
     * @param room {@link Room} or {@link Room.id} to get
     */
    public getRoom(room: number | Room): Room {
        const rooms = this.#rooms;

        const isId = typeof room === "number";
        const roomId = isId ? room : room.id;

        const existingRoom = rooms.get(roomId);
        if (existingRoom) {
            return existingRoom;
        }

        const newRoom = isId ? new Room(this, roomId) : room;
        rooms.set(roomId, newRoom);
        return newRoom;
    }

    /**
     * @summary gets a given chat message transcript info
     * @param message message or message ID to get the transcript for
     */
    public getTranscript(message: number | Message): Promise<ITranscriptData> {
        const browser = this.#browser;
        return browser.getTranscript(message);
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
     * @memberof Client#
     */
    public async login(email: string, password: string): Promise<string> {
        if (!password) {
            throw new InvalidArgumentError("Email and password are required.");
        }

        if (!validate(email)) throw new InvalidArgumentError("Invalid email");

        return this.#browser.login(email, password);
    }

    /**
     * @summary attempts to logout from the Stack Exchange network
     * @returns {Promise<boolean>} status of the logout
     * @memberof Client#
     */
    public async logout(): Promise<boolean> {
        const browser = this.#browser;

        return !browser.loggedIn || browser.logout();
    }

    /**
     * Attempts to login to stack exchange, using the provided
     * cookie jar string, which was retrieved from the `login`
     * method.
     *
     * @param {string} cookieString A cookie jar string
     * @returns {Promise<void>} A promise representing when login is complete
     * @memberof Client#
     */
    public async loginCookie(cookieString: string): Promise<void> {
        if (typeof cookieString !== "string" || cookieString === "") {
            throw new InvalidArgumentError("cookieString is required.");
        }

        return this.#browser.loginCookie(cookieString);
    }

    /**
     * @summary Joins a given room
     * @param room The room or ID to join
     * @returns {Promise<boolean>}
     * @memberof Client#
     */
    public async joinRoom(room: number | Room): Promise<boolean> {
        return this.#browser.joinRoom(this.getRoom(room));
    }

    /**
     * @summary Leaves a given room
     * @param room The room or ID to leave
     * @returns {Promise<boolean>}
     * @memberof Client#
     */
    public leaveRoom(room: number | Room): Promise<boolean> {
        return this.#browser.leaveRoom(room);
    }

    /**
     * @summary Leaves all rooms (on same chat server)
     * @returns {Promise<boolean>}
     * @memberof Client#
     */
    public leaveAll(): Promise<boolean> {
        return this.#browser.leaveAllRooms();
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

    /**
     * @summary sends a message to a given room
     * @param message message to send
     * @param room room or room ID to send to
     */
    public async send(message: string, room: number | Room): Promise<[boolean, Message]> {
        const browser = this.#browser;

        const roomId = typeof room === "number" ? room : room.id;

        const msg = await browser.sendMessage(roomId, message);
        return [true, msg];
    }

    /**
     * @summary watches a given {@link Room} for new events
     * @param room room or room ID to watch
     */
    public async watch(room: number | Room) {
        const browser = this.#browser;

        const watched = typeof room === "number" ? this.getRoom(room) : room;

        const ws = await browser.watchRoom(watched);

        ws.on("message", (rawMsg) => {
            const json = JSON.parse(rawMsg.toString());
            if (typeof json[`r${watched.id}`]?.e === "undefined") {
                return;
            }

            const events: ChatEvent[] = json[`r${watched.id}`].e;

            for (const event of events) {
                const msg = new WebsocketEvent(this, event);

                const skipRules = [
                    watched.isIgnored(msg.eventType),
                    msg.userId && watched.isBlocked(msg.userId),
                ];

                if (skipRules.some(Boolean)) continue;

                watched.emit("message", msg);
            }
        });

        ws.on("close", () => {
            if (watched.leaving) {
                watched.emit("close");
            } else {
                ws.removeAllListeners();
                watched.watch();
            }
        });

        return ws;
    }
}

export default Client;
