import * as cheerio from "cheerio";
import got, { Method, OptionsOfJSONResponseBody, Response } from "got";
import { Cookie, CookieJar } from "tough-cookie";
import { URL } from "url";
import WebSocket from "ws";
import Client, { Host } from "./Client";
import ChatExchangeError from "./Exceptions/ChatExchangeError";
import LoginError from "./Exceptions/LoginError";
import ScrapingError from "./Exceptions/ScrapingError";
import Message from "./Message";
import User from "./User";
import { arrayToKvp, lazy, parseAgoString } from "./utils";
import { ChatEventsResponse } from "./WebsocketEvent";

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

type ContentType = "json" | "text";

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
    public get root() {
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

        const $ = await this.#get$(`https://${this.#client.host}/`);

        const res = $(".my-profile");

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

        const $ = await this.#get$(loginUrl);

        const fkeySelector = 'input[name="fkey"]';
        const fkeyElem = $(fkeySelector);
        const fkey = fkeyElem.val();

        if (typeof fkey === "undefined") {
            throw new ScrapingError(
                "fkey missing (login)",
                $.html(),
                fkeySelector
            );
        }

        await this.#post(loginUrl, { email, fkey, password }, "text");

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
     * @summary Joins a room with the provided ID
     * @param {number} id The room ID to join
     * @returns {Promise<boolean>} A promise that resolves when the user has successfully joined the room
     * @memberof Browser#
     */
    public async joinRoom(id: number): Promise<boolean> {
        const { body, statusCode } = await this.#postKeyed<ChatEventsResponse>(
            `chats/${id}/events`,
            {
                mode: "Messages",
                msgCount: 100,
                since: 0,
            }
        );

        const { time } = body;
        this.#times.set(id, time);
        return statusCode === 200;
    }

    /**
     * @summary Leaves a room with the provided ID
     * @param {number} id The room ID to leave
     * @returns {Promise<boolean>} A promise that resolves when the user leaves the room
     * @memberof Browser#
     */
    public async leaveRoom(id: number): Promise<boolean> {
        const { statusCode } = await this.#postKeyed<ChatEventsResponse>(
            `chats/leave/${id}`,
            { quiet: true }
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
            { quiet: true }
        );

        const isSuccess = statusCode === 200;
        if (isSuccess) this.#times.clear();
        return isSuccess;
    }

    /**
     * @summary Watch a room, and returns the websocket
     * @param {number} roomid The room ID to join
     * @returns {Promise<WebSocket>} The websocket of this room
     * @memberof Browser#
     */
    public async watchRoom(roomid: number): Promise<WebSocket> {
        const { root } = this;

        const { body } = await this.#postKeyed<{ url: string }>("ws-auth", {
            roomid,
        });

        const l = this.#times.get(roomid);
        if (!l) {
            const entries = [...this.#times.entries()];
            const report = entries
                .map(([k, v]) => `${k} : ${v || "missing"}`)
                .join("\n");
            throw new ChatExchangeError(
                `missing time key for room ${roomid}\n\nTime keys\n${report}`
            );
        }

        const address = new URL(body.url);
        address.searchParams.append("l", l.toString());

        const ws = new WebSocket(address, { origin: root });

        // simple instantiation of WebSocket does not guarantee its readiness
        // only after the "open" event fires, a WebSocket is ready for data transfer
        // awaiting a promise till this happens ensures the returned WS is ready
        await new Promise((r) => ws.once("open", r));

        return ws;
    }

    /**
     * @summary Fetches a users profile
     * @param {number} userId The user to fetch
     * @returns {Promise<IProfileData>} The profile object
     * @memberof Browser#
     */
    public async getProfile(userId: number): Promise<IProfileData> {
        const $ = await this.#get$(`users/${userId}`);

        const id = userId;
        const name = $("h1").text();
        const isModerator = $(".user-status").first().text().includes("♦");

        const roomCount = Number($(".user-room-count-xxl").text());
        const messageCount = Number($(".user-message-count-xxl").text());

        const repElems = $(".reputation-score");

        const reputation = Number(repElems.attr("title") || "1") || 1;

        // Filter out only text (Ignore HTML entirely)
        const statsElements: string[] = $(".user-keycell,.user-valuecell")
            .map((_i, el) =>
                $(el)
                    .text()
                    .trim()
                    .replace(/\s{2,}[\w\s()]*/u, "")
            )
            .get();

        const {
            about,
            "last message": lmsg,
            "last seen": lseen,
        } = arrayToKvp(statsElements);

        const lastMessage = lmsg !== void 0 ? parseAgoString(lmsg) : -1;
        const lastSeen = lseen !== void 0 ? parseAgoString(lseen) : -1;

        return {
            about,
            id,
            isModerator,
            lastMessage,
            lastSeen,
            messageCount,
            name,
            reputation,
            roomCount,
        };
    }

    /**
     * Scrapes the transcript for a message, and returns the message metadata
     *
     * @param {number} msgId The message ID to scrape
     * @returns {Promise<ITranscriptData>}
     * @memberof Browser#
     */
    public async getTranscript(msgId: number): Promise<ITranscriptData> {
        const $ = await this.#get$(`transcript/message/${msgId}`);

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
     * @summary Sends a message to a room
     * @param {number} roomId The room ID to send to
     * @param {string} text The message to send
     * @returns {Promise<Message>} A promise that resolves the message that was sent
     * @memberof Browser#
     */
    public async sendMessage(roomId: number, text: string): Promise<Message> {
        const { body } = await this.#postKeyed<{ id: number }>(
            `chats/${roomId}/messages/new`,
            { text }
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
        const $ = await this.#get$("chats/join/favorite");
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
     * @param {Method} method request method (i.e. "GET")
     * @param {string} url request URL
     * @param {Record<string, unknown>} form form data
     * @param {object} searchParams query string data
     * @param {ContentType} [type] parse response as json?
     * @returns {Promise<Response<any>>}
     */
    async #request<T>(
        method: Method,
        url: string,
        form: Record<string, unknown>,
        searchParams: Record<string, string | number | boolean>,
        type?: ContentType
    ) {
        const options: OptionsOfJSONResponseBody = {
            cookieJar: this.#cookieJar,
            method,
            searchParams,
        };

        if (type === "json") {
            options.responseType = "json";
        }

        //ensures empty body is not added on GET requests
        if (method.toUpperCase() !== "GET") {
            options.form = form;
        }

        const res = await got<T>(this.#forceAbsoluteURL(url), options);

        if (res.statusCode >= 400) {
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
     * @param {string} uri request URI
     * @param {object} [qs] query string data
     * @returns {Promise<import("cheerio").Root>}
     */
    async #get$(uri: string, qs = {}) {
        const res = await this.#request<string>("get", uri, {}, qs);
        return cheerio.load(res.body);
    }

    /**
     * @private
     *
     * @summary POST request helper
     * @param {string} uri request URI
     * @param {object} data request data
     * @param {ContentType} type response parse type
     * @param {object} [qs] query string data
     * @returns {Promise<Response<any>>}
     */
    #post<T>(
        uri: string,
        data: Record<string, unknown>,
        type: ContentType,
        qs = {}
    ) {
        return this.#request<T>("post", uri, data, qs, type);
    }

    /**
     * @private
     *
     * @summary POST request helper with fkey parameter set
     * @param {string} uri request URI
     * @param {object} [data] request data
     * @param {object} [qs] query string data
     * @returns {Promise<Response<any>>}
     */
    async #postKeyed<T>(uri: string, data: object = {}, qs: object = {}) {
        return this.#post<T>(
            uri,
            { ...data, fkey: await this.chatFKey },
            "json",
            qs
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
}

export default Browser;
