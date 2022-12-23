import * as cheerio from "cheerio";
import got, { Method, OptionsOfJSONResponseBody } from "got";
import { Cookie, CookieJar } from "tough-cookie";
import { URL } from "url";
import WebSocket from "ws";
import Client, { isAllowedHost, type Host } from "./Client";
import ChatExchangeError from "./Exceptions/ChatExchangeError";
import LoginError from "./Exceptions/LoginError";
import ScrapingError from "./Exceptions/ScrapingError";
import Message from "./Message";
import type Room from "./Room.js";
import User from "./User";
import { arrayToKvp, lazy, parseAgoString } from "./utils";
import type { ChatEventsResponse } from "./WebsocketEvent";

got.extend({
    followRedirect: false,
    headers: { "User-Agent": "Node.js/ChatExchange" },
    decompress: true,
});

export interface IProfileData {
    id: number;
    name: string;
    about: string;
    isModerator: boolean;
    roomCount: number;
    messageCount: number;
    reputation: number;
    lastSeen: number;
    lastMessage: number;
    parentId?: number;
    parentHost?: Host;
    parentSite?: string;
}

export interface ITranscriptData {
    id: number;
    user: User;
    content: string;
    roomId: number;
    roomName: string;
    edited: boolean;
    parentMessageId?: number;
}

export interface IRoomSave {
    defaultAccess?: "read-only" | "read-write",
    description: string;
    host: Host;
    name: string;
    tags?: string[];
}

type ContentType = "json" | "text";

export enum DeleteMessageStatus {
    SUCCESS = 0,
    TOO_OLD = 1,
    DELETED = 2,
    UNKNOWN = 4
}

interface RequestOptions {
    /** request method (i.e. "get") */
    method?: Method,
    /** request body */
    data?: Record<string, unknown>,
    /** HTTP error status codes (>= 400) to not throw on */
    mutedStatusCodes?: number[];
    /** query string parameters */
    params?: Record<string, string | number | boolean>,
    /** Content-Type header config (JSON or plain text) */
    type?: ContentType,
}

/**
 * Used internally by {@link Client} to provide the low-level
 * interaction with SE servers.
 *
 * @class Browser
 * @property {boolean} loggedIn User logged in
 */
export class Browser {
    public loggedIn = false;

    #client: Client;
    #cookieJar: CookieJar;
    #fkey?: string;
    #userId?: number;
    #userName?: string;

    /**
     * @private
     * @summary internal <roomId, time> Map (needed for watchRoom)
     */
    #times: Map<number, number> = new Map();

    constructor(client: Client) {
        this.#client = client;
        this.#cookieJar = new CookieJar();
        client.browser = this;
    }

    /**
     * @summary getter for login host domain name
     * @returns {string}
     * @memberof Browser#
     */
    public get loginHost(): Host {
        const { host } = this.#client;
        return host === "stackexchange.com" ? "meta.stackexchange.com" : host;
    }

    /**
     * @summary proxy getter for the chat host URL
     * @returns {string}
     * @memberof Browser#
     */
    public get root(): string {
        return this.#client.root;
    }

    /**
     * @summary The chat key for use with ws-auth, and other authy endpoints
     * @returns {Promise<string>}
     * @memberof Browser#
     */
    public get chatFKey(): Promise<string> {
        return lazy<string>(
            () => this.#fkey,
            () => this.#updateChatFKeyAndUser()
        );
    }

    /**
     * @summary The user id of the logged in user
     * @returns {Promise<number>}
     * @memberof Browser#
     */
    public get userId(): Promise<number> {
        return lazy<number>(
            () => this.#userId,
            () => this.#updateChatFKeyAndUser()
        );
    }

    /**
     * @summary The user name of the logged in user
     * @returns {Promise<string>}
     * @memberof Browser#
     */
    public get userName(): Promise<string> {
        return lazy<string>(
            () => this.#userName,
            () => this.#updateChatFKeyAndUser()
        );
    }

    /**
     * Attempts to login to stack exchange, using the provided
     * cookie jar string, which was retrieved from the {@Link Browser#login}
     * method.
     *
     * @param {string|CookieJar.Serialized} cookie A cookie jar string
     * @returns {Promise<void>} A promise that completes with the user logs in
     * @memberof Browser#
     */
    public async loginCookie(
        cookie: string | CookieJar.Serialized
    ): Promise<void> {
        this.#cookieJar = CookieJar.deserializeSync(cookie);

        const [, $] = await this.#get$(`https://${this.#client.host}/`);

        const res = $("input[name=fkey]:not([value=''])");

        if (res.length === 0) {
            throw new LoginError(
                "Login with acct string could not be verified, try credential login instead.",
                { cookie }
            );
        }

        this.loggedIn = true;
    }

    /**
     * Attempts to login to stack exchange, using the provided
     * email and password. Returns a cookie jar string, which
     * you can pass back in to loginCookieJar for use with further
     * logins.
     *
     * @param {string} email Email
     * @param {string} password Password
     * @returns {Promise<string>} A cookie jar containing account pertitent details.
     * @memberof Browser#
     */
    public async login(email: string, password: string): Promise<string> {
        const { loginHost } = this;

        const loginUrl = `https://${loginHost}/users/login`;

        const fkey = await this.#scrapeFkey("users/login");

        await this.#post(loginUrl, { data: { email, fkey, password }, type: "text" });

        const acctCookie = await this.#getCookie("acct");

        if (typeof acctCookie === "undefined") {
            throw new LoginError(
                "failed to get acct cookie from Stack Exchange OpenID, check creds provided for accuracy",
                { email, password }
            );
        }

        this.loggedIn = true;

        return JSON.stringify(this.#cookieJar);
    }

    /**
     * @summary attempts to logout from the Stack Exchange network
     * @returns {Promise<boolean>} status of the logout attempt
     * @memberof Browser#
     */
    public async logout(): Promise<boolean> {
        const { loginHost } = this;

        const logoutUrl = `https://${loginHost}/users/logout`;

        const fkey = await this.#scrapeFkey("users/logout");

        const res = await this.#post(logoutUrl, { data: { fkey }, type: "text" });

        return (this.loggedIn = res.statusCode === 200);
    }

    /**
     * @summary attempts to create a {@link Room}
     * @param config room configuration options
     */
    public async createRoom(config: IRoomSave): Promise<number> {
        const { tags = [], defaultAccess = "read-write" } = config;

        const res = await this.#postKeyed("rooms/save", {
            data: {
                ...config,
                host: `chat.${config.host}`,
                defaultAccess,
                noDupeCheck: true,
                tags: tags.join(" "),
            },
        });

        // this is not a mistake
        if(res.statusCode !== 302 || !res.headers.location) {
            throw new ChatExchangeError("failed to create a room");
        }

        const [, roomId] = res.headers.location.match(/rooms\/info\/(\d+)/) || [];

        const numericRoomId = +roomId;
        if(!numericRoomId) {
            throw new ChatExchangeError("failed to get created room id");
        }

        return numericRoomId;
    }

    /**
     * @summary attempts to update a {@link Room}
     * @param roomId id of the room to update
     * @param config room configuration options
     */
    public async updateRoom(
        roomId: number,
        config: IRoomSave,
    ): Promise<number> {
        const { tags = [], defaultAccess = "read-write" } = config;

        const res = await this.#postKeyed("rooms/save", {
            data: {
                ...config,
                host: `chat.${config.host}`,
                defaultAccess,
                noDupeCheck: true,
                tags: tags.join(" "),
            },
        });

        // this is not a mistake
        if(res.statusCode !== 302 || !res.headers.location) {
            throw new ChatExchangeError("failed to update a room");
        }

        return roomId;
    }

    /**
     * @summary Joins a given room
     * @param room The room or room ID to join
     * @returns {Promise<boolean>} A promise that resolves when the user has successfully joined the room
     * @memberof Browser#
     */
    public async joinRoom(room: number | Room): Promise<boolean> {
        const id = typeof room === "number" ? room : room.id;

        const { body, statusCode } = await this.#postKeyed<ChatEventsResponse>(
            `chats/${id}/events`,
            {
                data: {
                    mode: "Messages",
                    msgCount: 100,
                    since: 0,
                }
            }
        );

        // https://github.com/samliew/chatexchange/issues/207
        const parsedBody = typeof body === "string" ? JSON.parse(body) : body;

        const { time } = parsedBody;
        this.#times.set(id, time);
        return statusCode === 200;
    }

    /**
     * @summary Leaves a given room
     * @param room The room or room ID to leave
     * @returns {Promise<boolean>} A promise that resolves when the user leaves the room
     * @memberof Browser#
     */
    public async leaveRoom(room: number | Room): Promise<boolean> {
        const id = typeof room === "number" ? room : room.id;

        const { statusCode } = await this.#postKeyed<ChatEventsResponse>(
            `chats/leave/${id}`,
            { data: { quiet: true } }
        );

        const isSuccess = statusCode === 200;
        if (isSuccess) this.#times.delete(id);
        return isSuccess;
    }

    /**
     * @summary Leaves all rooms
     * @returns {Promise<boolean>} A promise resolving when the user leaves all rooms
     * @memberof Browser#
     */
    public async leaveAllRooms(): Promise<boolean> {
        const { statusCode } = await this.#postKeyed<ChatEventsResponse>(
            `chats/leave/all`,
            { data: { quiet: true } }
        );

        const isSuccess = statusCode === 200;
        if (isSuccess) this.#times.clear();
        return isSuccess;
    }

    /**
     * @summary lists users in a given room
     * @param room The room or room ID
     */
    public async listUsers(room: number | Room): Promise<User[]> {
        const { root } = this;

        const roomid = typeof room === "number" ? room : room.id;

        const [, $] = await this.#get$(`${root}rooms/info/${roomid}`, {
            params: {
                id: roomid,
                tag: "general",
                users: "current",
            }
        });

        const client = this.#client;

        const users: User[] = [];

        $("#room-usercards .usercard").each((_, card) => {
            const userName = $(card).find(".user-header")?.attr("title") || "";
            const name = userName.replace(/\s\u2666$/, '');

            const userLink = $(card).find(`.user-header a[href*="/users/"]`)?.attr("href") || "";
            const [, userId] = /(\d+)/.exec(userLink) || [];
            if (Number.isNaN(+userId)) return;

            const about = $(card).find(".user-message-info")?.attr("title") || "";

            const isModerator = !!$(card).find(".user-header .moderator").length;

            users.push(new User(client, +userId, { about, isModerator, name, }));
        });

        return users;
    }

    /**
     * @summary Watch a room, and returns the websocket
     * @param room The room or room ID to join
     * @returns {Promise<WebSocket>} The websocket of this room
     * @memberof Browser#
     */
    public async watchRoom(room: number | Room): Promise<WebSocket> {
        const { root } = this;

        const roomid = typeof room === "number" ? room : room.id;

        const { body } = await this.#postKeyed<{ url: string; }>(
            "ws-auth",
            { data: { roomid, } }
        );

        const l = this.#times.get(roomid);
        if (!l) {
            const entries = [...this.#times];
            const report = entries
                .map(([k, v]) => `${k} : ${v || "missing"}`)
                .join("\n");
            throw new ChatExchangeError(
                `missing time key for room ${roomid}\n\nTime keys\n${report}`
            );
        }

        // https://github.com/samliew/chatexchange/issues/207
        const parsedBody = typeof body === "string" ? JSON.parse(body) : body;

        const { url } = parsedBody;
        if(!url) {
            throw new ChatExchangeError(`missing URL in the ws-auth response:\n${body}`);
        }

        const address = new URL(url);
        address.searchParams.append("l", l.toString());

        const ws = new WebSocket(address, { origin: root });

        // simple instantiation of WebSocket does not guarantee its readiness
        // only after the "open" event fires, a WebSocket is ready for data transfer
        // awaiting a promise till this happens ensures the returned WS is ready
        await new Promise((r) => ws.once("open", r));

        return ws;
    }

    /**
     * @summary Fetches a given user's profile
     * @param user The user or user ID to fetch
     * @returns {Promise<IProfileData>} The profile object
     * @memberof Browser#
     */
    public async getProfile(user: number | User): Promise<IProfileData> {
        const userId = typeof user === "number" ? user : user.id;

        const [code, $] = await this.#get$(`users/${userId}`, { mutedStatusCodes: [404] });

        if (code === 404) {
            throw new ScrapingError(`failed to get user #${userId}`, $.html());
        }

        const name = $("h1").text();
        const isModerator = $(".user-status").first().text().includes("♦");

        const roomCount = Number($(".user-room-count-xxl").text());
        const messageCount = Number($(".user-message-count-xxl").text());

        const repElems = $(".reputation-score");

        const reputation = Number(repElems.attr("title") || "1") || 1;

        const statsCells = $(".user-keycell,.user-valuecell");

        // Filter out only text (Ignore HTML entirely)
        const statsElements: string[] = statsCells
            .map((_i, el) => $(el).text().trim().replace(/\s{2,}[\w\s()]*/u, ""))
            .get();

        const {
            about,
            "last message": lmsg,
            "last seen": lseen,
        } = arrayToKvp(statsElements);

        const lastMessage = lmsg !== void 0 ? parseAgoString(lmsg) : -1;
        const lastSeen = lseen !== void 0 ? parseAgoString(lseen) : -1;

        const profile: IProfileData = {
            about,
            id: userId,
            isModerator,
            lastMessage,
            lastSeen,
            messageCount,
            name,
            reputation,
            roomCount,
        };

        const [parentCell] = statsCells.filter((_, el) => $(el).text().trim() === "parent user");
        const [parentValueCell] = $(parentCell).next();

        const parentHref = $(parentValueCell).find("a[href*='/users/']").attr("href")?.trim();

        // https://regex101.com/r/SqNlXB/1
        const parentIdUnparsed = parentHref?.replace(/.+?\/users\/(\d+).*$/, "$1");
        const parentId = parentIdUnparsed && parseInt(parentIdUnparsed, 10);
        if (parentId) profile.parentId = parentId;

        // https://regex101.com/r/Aqx7Qs/3
        const parentSite = parentHref?.replace(/(?:https?:|^)\/{2}(.+?)\/users.*?$/, "$1");
        const parentHost = isAllowedHost(parentSite) ?
            parentSite :
            // https://regex101.com/r/i6c9zB/1
            parentSite?.replace(/^.+?\.(?=stackoverflow|stackexchange)/, "") as Host | undefined;

        profile.parentHost = parentHost;
        profile.parentSite = parentSite;

        return profile;
    }

    /**
     * @summary Scrapes the transcript for a message, and returns the message metadata
     * @param message The message or message ID to scrape
     * @returns {Promise<ITranscriptData>}
     * @memberof Browser#
     */
    public async getTranscript(message: number | Message): Promise<ITranscriptData> {
        const msgId = typeof message === "number" ? message : message.id;
        if (!msgId) {
            throw new ChatExchangeError("cannot get a transcript of an invalid message");
        }

        const [code, $] = await this.#get$(`transcript/message/${msgId}`, { mutedStatusCodes: [404] });

        if (code === 404) {
            throw new ScrapingError(`failed to get message #${msgId}`, $.html());
        }

        const $msg = $(".message.highlight");
        const $room = $(".room-name a");

        const $userDiv = $msg.parent().prev(".signature").find(".username a"); // Possible for $userDiv element to be missing for some reason
        const $monologue = $msg.closest('.monologue'); // Fallback to the monologue element

        const userId = Number($userDiv?.attr("href")?.split("/")[2] ?? $monologue?.attr('class')?.match(/\d+$/)?.pop());
        const userName = $userDiv.text();

        const user = this.#client.getUser(userId, { name: userName });

        const roomName = $room.text();
        const roomId = Number($room.attr("href")!.split("/")[2]); // eslint-disable-line prefer-destructuring

        const edited = $msg.find(".edits").length > 0;
        const content = $msg.find(".content").text().trim();

        const replyInfo = $msg.find(".reply-info");

        let parentMessageId;
        if (replyInfo.length > 0) {
            parentMessageId = Number(replyInfo.attr("href")!.split("#")[1]);
        }

        return {
            content,
            edited,
            id: msgId,
            parentMessageId,
            roomId,
            roomName,
            user,
        };
    }

    /**
     * @summary Deletes a message
     * @param {number} messageId ID of the message to delete
     */
    public async deleteMessage(messageId: number): Promise<DeleteMessageStatus> {
        const { host } = this.#client;

        const { body } = await this.#postKeyed<string>(
            `https://chat.${host}/messages/${messageId}/delete`,
            { type: "text" }
        );

        const statusMap: Record<string, DeleteMessageStatus> = {
            "ok": DeleteMessageStatus.SUCCESS,
            "It is too late to delete this message": DeleteMessageStatus.TOO_OLD,
            "This message has already been deleted.": DeleteMessageStatus.DELETED
        };

        return statusMap[body] !== void 0 ?
            statusMap[body] :
            DeleteMessageStatus.UNKNOWN;
    }

    /**
     * @summary Sends a message to a room
     * @param {number} roomId The room ID to send to
     * @param {string} text The message to send
     * @returns {Promise<Message>} A promise that resolves the message that was sent
     * @memberof Browser#
     */
    public async sendMessage(roomId: number, text: string): Promise<Message> {
        const { body } = await this.#postKeyed<{ id: number; }>(
            `chats/${roomId}/messages/new`,
            { data: { text } }
        );

        return new Message(this.#client, body.id, { roomId });
    }

    /**
     * @private
     *
     * @summary refreshes user fkey
     * @param {cheerio.Root} $ Cheerio root element
     * @returns {string}
     */
    #loadFKey($: cheerio.Root): string {
        const fkeySelector = 'input[name="fkey"]';

        const fkey = $(fkeySelector).val();

        this.#fkey = fkey;

        if (typeof fkey === "undefined") {
            throw new ScrapingError(
                "Unable to find fkey",
                $.html(),
                fkeySelector
            );
        }

        return fkey;
    }

    /**
     * @private
     *
     * @summary refreshes user info
     * @param {cheerio.Root} $ Cheerio root element
     * @returns {number}
     */
    #loadUser($: cheerio.Root): number {
        const userLink = $(".topbar-menu-links a");

        const [, , userId, userName] = userLink.attr("href")?.split("/") || [];
        const id = Number(userId);

        this.#userId = id;
        this.#userName = userName;
        return id;
    }

    /**
     * @private
     *
     * @summary refreshes user fkey and user info
     * @returns {Promise<void>}
     */
    async #updateChatFKeyAndUser(): Promise<void> {
        const [, $] = await this.#get$("chats/join/favorite");
        this.#loadFKey($);
        this.#loadUser($);
    }

    /**
     * @private
     *
     * @summary helper for forcing absolute URLs
     * @param {string} url URL to request
     * @returns {string}
     */
    #forceAbsoluteURL(url: string) {
        const parsed = new URL(url, this.root);
        return parsed.toString();
    }

    /**
     * @private
     *
     * @summary abstract request helper
     * @param url request URL
     * @param config request configuration
     */
    async #request<T>(
        url: string,
        config: RequestOptions,
    ) {
        const {
            data,
            method = "GET",
            mutedStatusCodes: muteErrors = [],
            params,
            type
        } = config;

        const options: OptionsOfJSONResponseBody = {
            cookieJar: this.#cookieJar,
            method,
            searchParams: params,
        };

        if (type === "json") {
            options.responseType = "json";
        }

        //ensures empty body is not added on GET requests
        if (method.toUpperCase() !== "GET") {
            options.form = data;
        }

        const res = await got<T>(this.#forceAbsoluteURL(url), options);

        const { statusCode } = res;

        if (statusCode >= 400 && !muteErrors.includes(statusCode)) {
            throw new ChatExchangeError(
                `Remote server threw ${res.statusCode} error\nURL: ${url}`
            );
        }

        return res;
    }

    /**
     * @private
     *
     * @summary cheeiro parsed data request helper
     * @param uri request URI
     * @param config request configuration
     */
    async #get$(uri: string, config: Omit<RequestOptions, "method"> = {}): Promise<[code: number, page: cheerio.Root]> {
        const res = await this.#request<string>(uri, config);
        return [res.statusCode, cheerio.load(res.body)];
    }

    /**
     * @private
     *
     * @summary POST request helper
     * @param uri request URI
     * @param config request configuration
     */
    #post<T>(
        uri: string,
        config: Omit<RequestOptions, "method">,
    ) {
        return this.#request<T>(uri, { method: "post", ...config });
    }

    /**
     * @private
     *
     * @summary POST request helper with fkey parameter set
     * @param uri request URI
     * @param confg request configuration
     */
    async #postKeyed<T>(
        uri: string,
        config: Omit<RequestOptions, "method">,
    ) {
        return this.#post<T>(
            uri,
            {
                ...config,
                data: {
                    ...config.data,
                    fkey: await this.chatFKey
                },
            }
        );
    }

    /**
     * @private
     *
     * @summary gets a cookie by key
     * @param {string} key cookie key
     * @returns {Promise<Cookie>}
     */
    async #getCookie(key: string) {
        const cookies = await this.#cookieJar.getCookies(
            `https://${this.#client.host}`
        );

        return cookies.find((cookie: Cookie) => cookie.key === key);
    }

    /**
     * @private
     *
     * @summary gets an fkey value for a given path
     * @param path path on the {@link Browser#loginHost}
     *
     * @throws {ScrapingError} if fkey is missing
     */
    async #scrapeFkey(path: string): Promise<string> {
        const { loginHost } = this;

        const url = `https://${loginHost}/${path.replace(/^\//, "")}`;

        const [, $] = await this.#get$(url);

        const fkeySelector = 'input[name="fkey"]';
        const fkeyElem = $(fkeySelector);
        const fkey = fkeyElem.val();

        if (typeof fkey === "undefined") {
            throw new ScrapingError(
                `fkey missing (${path})`,
                $.html(),
                fkeySelector
            );
        }

        return fkey;
    }
}

export default Browser;
