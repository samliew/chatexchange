import * as cheerio from "cheerio";
import { Cookie } from "request";
import * as requestPromise from "request-promise-native";
import { CookieJar } from "tough-cookie";
import WebSocket from "ws";
import Client from "./Client";
import ChatExchangeError from "./Exceptions/ChatExchangeError";
import InternalError from "./Exceptions/InternalError";
import LoginError from "./Exceptions/LoginError";
import Message from "./Message";
import User from "./User";
import { arrayToKvp, lazy, parseAgoString } from "./utils";

const request = requestPromise.defaults({
    followRedirect: false,
    gzip: true,
    headers: {
        "User-Agent": "Node.js/ChatExchange",
    },
    resolveWithFullResponse: true,
    simple: false,
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

type ReqOptions = { uri: string } & requestPromise.RequestPromiseOptions;

/**
 * Used internally by {@link Client} to provide the low-level
 * interaction with SE servers.
 *
 * @class Browser
 * @property {boolean} loggedIn User logged in
 * @property {Promise<string>} chatFKey The chat key for use with ws-auth, and other authy endpoints
 * @property {Promise<number>} userId The user id of the logged in user
 * @property {Promise<string>} userName The user name of the logged in user
 */
class Browser {
    public loggedIn: boolean;
    private _client: Client;
    private _cookieJar: any;
    private _chatRoot: string;
    private _rooms: { [id: number]: { eventtime: unknown } } = {};
    private _chatFKey!: string;
    private _userId!: number;
    private _userName!: string;

    constructor(client: Client) {
        this.loggedIn = false;
        this._client = client;
        this._cookieJar = request.jar();
        this._chatRoot = client.root;
        this._rooms = {};
    }

    get chatFKey(): Promise<string> {
        return lazy<string>(
            () => this._chatFKey,
            () => this._updateChatFKeyAndUser()
        );
    }

    get userId(): Promise<number> {
        return lazy<number>(
            () => this._userId,
            () => this._updateChatFKeyAndUser()
        );
    }

    get userName(): Promise<string> {
        return lazy<string>(
            () => this._userName,
            () => this._updateChatFKeyAndUser()
        );
    }

    /**
     * Attempts to login to stack exchange, using the provided
     * cookie jar string, which was retrieved from the {@Link Browser#login}
     * method.
     *
     * @param {string|CookieJar.Serialized} cookieJar A cookie jar string
     * @returns {Promise<void>} A promise that completes with the user logs in
     * @memberof Browser
     */
    public async loginCookie(
        cookieJar: string | CookieJar.Serialized
    ): Promise<void> {
        this._cookieJar._jar = CookieJar.deserializeSync(cookieJar); // eslint-disable-line

        const $ = await this._get$(`https://${this._client.host}/`);

        const res = $(".my-profile");

        if (res.length === 0) {
            throw new LoginError(
                "Login with acct string could not be verified, " +
                    "try credential login instead."
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
     * @memberof Browser
     */
    public async login(email: string, password: string): Promise<string> {
        let loginHost = this._client.host;

        if (this._client.host === "stackexchange.com") {
            loginHost = "meta.stackexchange.com";
        }

        const $ = await this._get$(`https://${loginHost}/users/login`);

        const fkey = $('input[name="fkey"]').val();

        if (typeof fkey === "undefined") {
            throw new InternalError(
                "Unable to find fkey element on /users/login"
            );
        }

        await this._post(
            `https://${loginHost}/users/login`,
            {
                email,
                fkey,
                password,
            },
            {}
        );

        const acctCookie = this._getCookie("acct");

        if (typeof acctCookie === "undefined") {
            throw new LoginError(
                "failed to get acct cookie from Stack Exchange OpenID, " +
                    "check credentials provided for accuracy"
            );
        }

        this.loggedIn = true;

        return JSON.stringify(this._cookieJar._jar); // eslint-disable-line
    }

    /**
     * Joins a room with the provided ID
     *
     * @param {number} id The room ID to join
     * @returns {Promise<void>} A promise that resolves when the user has successfully joined the room
     * @memberof Browser
     */
    public async joinRoom(id: number): Promise<void> {
        const res = await this._postKeyed(`chats/${id}/events`, {
            mode: "Messages",
            msgCount: 100,
            since: 0,
        });

        this._rooms[id] = {
            eventtime: res.body.time,
        };
    }

    /**
     * Leaves a room with the provided ID
     *
     * @param {number} id The room ID to leave
     * @returns {Promise<void>} A promise that resolves when the user has successfully left the room
     * @memberof Browser
     */
    public async leaveRoom(id: number): Promise<void> {
        await this._postKeyed(`chats/leave/${id}`, {
            quiet: true,
        });
    }

    /**
     * Watch a room, and returns the websocket
     *
     * @param {number} id The room ID to join
     * @returns {Promise<WebSocket>} The websocket of this room
     * @memberof Browser
     */
    public async watchRoom(id: number): Promise<WebSocket> {
        const wsAuthData = await this._postKeyed("ws-auth", {
            roomid: id,
        });

        const wsUrl = `${wsAuthData.body.url}?l=${this._rooms[id].eventtime}`;

        const ws = new WebSocket(wsUrl, {
            origin: this._chatRoot,
        });

        return ws;
    }

    /**
     * Fetches a users profile
     *
     * @param {number} userId The user to fetch
     * @returns {Promise<IProfileData>} The profile object
     * @memberof Browser
     */
    public async getProfile(userId: number): Promise<IProfileData> {
        const $ = await this._get$(`users/${userId}`);

        const id = userId;
        const name = $("h1").text();
        const isModerator = $(".user-status").first().text().includes("♦");

        const roomCount = parseInt($(".user-room-count-xxl").text(), 10);
        const messageCount = parseInt($(".user-message-count-xxl").text(), 10);

        let reputation = 0; //TODO: rep can't be less than 1
        const reputationElements = $(".reputation-score");

        if (reputationElements.length > 0) {
            reputation = parseInt(reputationElements.attr("title") || "0", 10);
        }

        let lastSeen = -1;
        let lastMessage = -1;

        // Filter out only text (Ignore HTML entirely)
        const statsElements = $(".user-keycell,.user-valuecell")
            .map((_i, el) =>
                $(el)
                    .text()
                    .trim()
                    .replace(/\s{2,}[\w\s()]*/u, "")
            )
            .toArray();

        const {
            about,
            "last message": lmsg,
            "last seen": lseen,
            //@ts-expect-error
        } = arrayToKvp(statsElements);

        if (typeof lmsg !== "undefined") {
            lastMessage = parseAgoString(lmsg);
        }
        if (typeof lseen !== "undefined") {
            lastSeen = parseAgoString(lseen);
        }

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
     * @memberof Browser
     */
    public async getTranscript(msgId: number): Promise<ITranscriptData> {
        const $ = await this._get$(`transcript/message/${msgId}`);

        const $msg = $(".message.highlight");
        const $room = $(".room-name a");

        const $userDiv = $msg.parent().prev(".signature").find(".username a");

        const userId = parseInt($userDiv.attr("href")!.split("/")[2], 10);
        const userName = $userDiv.text();

        const user = this._client.getUser(userId, { name: userName });

        const roomName = $room.text();
        const roomId = parseInt($room.attr("href")!.split("/")[2], 10); // eslint-disable-line prefer-destructuring

        const edited = $msg.find(".edits").length > 0;
        const content = $msg.find(".content").text().trim();

        const replyInfo = $msg.find(".reply-info");

        let parentMessageId;
        if (replyInfo.length > 0) {
            parentMessageId = parseInt(
                replyInfo.attr("href")!.split("#")[1],
                10
            );
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
     * Sends a message to a room
     *
     * @param {number} roomId The room ID to send to
     * @param {string} text The message to send
     * @returns {Promise<Message>} A promise that resolves the message that was sent
     * @memberof Browser
     */
    public async sendMessage(roomId: number, text: string): Promise<Message> {
        const { id } = await this._postKeyed(`chats/${roomId}/messages/new`, {
            text,
        });

        return new Message(this._client, id, { roomId });
    }

    private async _updateChatFKeyAndUser() {
        const $ = await this._get$("chats/join/favorite");

        this._loadFKey($);
        this._loadUser($);
    }

    private _loadFKey($: cheerio.Root) {
        this._chatFKey = $('input[name="fkey"]').val();

        if (typeof this._chatFKey === "undefined") {
            throw new InternalError("Unable to find fkey.");
        }
    }

    private _loadUser($: cheerio.Root) {
        const userLink = $(".topbar-menu-links a");

        const [, , userId, userName] = userLink.attr("href")!.split("/");

        this._userId = parseInt(userId, 10);
        this._userName = userName;
    }

    // Request helpers
    private async _request(
        method: string,
        uri: string,
        form:
            | string
            | {
                  [key: string]: any;
              },
        qs: any
    ) {
        const options: ReqOptions = {
            form,
            jar: this._cookieJar,
            json: true,
            method,
            qs,
            uri,
        };

        if (!uri.startsWith("https://")) {
            options.uri = `${this._chatRoot}${uri}`;
        }

        const res = await request(options);

        if (res.statusCode >= 400) {
            throw new ChatExchangeError(
                `Remote server threw ${res.statusCode} error.`
            );
        }

        return res;
    }

    private async _get$(uri: string, qs = {}) {
        const res = await this._request("get", uri, {}, qs);

        return cheerio.load(res.body);
    }

    private _post(uri: string, data = {}, qs = {}) {
        return this._request("post", uri, data, qs);
    }

    private async _postKeyed(uri: string, data: any = {}, qs: any = {}) {
        data.fkey = await this.chatFKey;

        return this._post(uri, data, qs);
    }

    private _getCookie(key: string) {
        const cookies = this._cookieJar.getCookies(
            `https://${this._client.host}`
        );

        return cookies.find((cookie: Cookie) => cookie.key === key);
    }
}

export default Browser;
