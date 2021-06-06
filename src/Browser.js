import { default as requestPromise } from 'request-promise-native';
import cheerio from 'cheerio';
import WebSocket from 'ws';
import { CookieJar } from 'tough-cookie';
import ChatExchangeError from './Exceptions/ChatExchangeError';
import InternalError from './Exceptions/InternalError';
import LoginError from './Exceptions/LoginError';
import { lazy, parseAgoString, arrayToKvp } from './utils';

const request = requestPromise.defaults({
    gzip: true,
    simple: false,
    resolveWithFullResponse: true,
    followRedirect: false,
    headers: {
        'User-Agent': 'Node.js/ChatExchange',
    },
});

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

    constructor(host) {
        this.host = host;
        this.loggedIn = false;
        this._cookieJar = request.jar();
        this._chatRoot = `https://chat.${this.host}/`;
        this._rooms = {};
    }
    
    get chatFKey() {
        return lazy(() => this._chatFKey, () => this._updateChatFKeyAndUser());
    }

    get userId() {
        return lazy(() => this._userId, () => this._updateChatFKeyAndUser());
    }

    get userName() {
        return lazy(() => this._userName, () => this._updateChatFKeyAndUser());
    }

    /**
     * Attempts to login to stack exchange, using the provided
     * cookie jar string, which was retrieved from the {@Link Browser#login}
     * method.
     *
     * @param {string} cookieJar A cookie jar string
     * @returns {void}
     * @memberof Browser
     */
    async loginCookie(cookieJar) {
        this._cookieJar._jar = CookieJar.deserializeSync(cookieJar); // eslint-disable-line

        const $ = await this._get$(`https://${this.host}/`);

        const res = $('.my-profile');

        if (res.length === 0) {
            throw new LoginError('Login with acct string could not be verified, ' +
                'try credential login instead.');
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
     * @returns {string} A cookie jar containing account pertitent details.
     * @memberof Browser
     */
    async login(email, password) {

        let loginHost = this.host;
        if (this.host === 'stackexchange.com') {
            loginHost = 'meta.stackexchange.com';
        }
        
        const $ = await this._get$(`https://${loginHost}/users/login`);

        const fkey = $('input[name="fkey"]').val();

        if (typeof fkey === 'undefined') {
            throw new InternalError('Unable to find fkey element on /users/login');
        }

        await this._post(`https://${loginHost}/users/login`, {
            fkey,
            email,
            password,
        }, {});

        const acctCookie = this._getCookie('acct');

        if (typeof acctCookie === 'undefined') {
            throw new LoginError('failed to get acct cookie from Stack Exchange OpenID, ' +
                'check credentials provided for accuracy');
        }

        this.loggedIn = true;

        return JSON.stringify(this._cookieJar._jar); // eslint-disable-line
    }

    /**
     * Joins a room with the provided ID
     *
     * @param {number} id The room ID to join
     * @returns {Promise<void>} A promise that resolves with the user has successfully joined the room
     * @memberof Browser
     */
    async joinRoom(id) {
        const res = await this._postKeyed(`chats/${id}/events`, {
            since: 0,
            mode: 'Messages',
            msgCount: 100,
        });

        this._rooms[id] = {
            eventtime: res.body.time,
        };
    }

    /**
     * Watch a room, and returns the websocket
     *
     * @param {number} id The room ID to join
     * @returns {Promise<WebSocket>} The websocket of this room
     * @memberof Browser
     */
    async watchRoom(id) {
        const wsAuthData = await this._postKeyed('ws-auth', {
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
     * @returns {Promise<Object>} The profile object 
     * @memberof Browser
     */
    async getProfile(userId) {
        const $ = await this._get$(`users/${userId}`);

        const name = $('h1').text();
        const isModerator = $('.user-status').first()
            .text()
            .includes('♦');

        const roomCount = parseInt($('.user-room-count-xxl').text(), 10);
        const messageCount = parseInt($('.user-message-count-xxl').text(), 10);

        let reputation = 0;
        const reputationElements = $('.reputation-score');

        if (reputationElements.length > 0) {
            reputation = parseInt(reputationElements.attr('title'), 10);
        }

        let lastSeen = -1;
        let lastMessage = -1;

        // Filter out only text (Ignore HTML entirely)
        const statsElements = $('.user-keycell,.user-valuecell').map((idx, el) => $(el)
            .contents()
            .filter((childIdx, child) => child.nodeType === 3)
            .text()
            .trim())
            .toArray();

        const stats = arrayToKvp(statsElements);
        const { about } = stats;

        if (typeof stats['last message'] !== 'undefined') {
            lastMessage = parseAgoString(stats['last message']);
        }
        if (typeof stats['last seen'] !== 'undefined') {
            lastSeen = parseAgoString(stats['last seen']);
        }

        return {
            name,
            isModerator,
            roomCount,
            messageCount,
            reputation,
            lastSeen,
            lastMessage,
            about,
        };
    }

    /**
     * Sends a message to a room
     *
     * @param {number} roomId The room ID to send to
     * @param {string} message The message to send
     * @returns {Promise<void>} A promise that resolves when the message has been sent
     * @memberof Browser
     */
    sendMessage(roomId, message) {
        return this._postKeyed(`chats/${roomId}/messages/new`, {
            text: message,
        });
    }

    async _updateChatFKeyAndUser() {
        const $ = await this._get$('chats/join/favorite');

        this._loadFKey($);
        this._loadUser($);

        return this._fkey;
    }

    _loadFKey($) {
        this._chatFKey = $('input[name="fkey"]').val();

        if (typeof this._chatFKey === 'undefined') {
            throw new InternalError('Unable to find fkey.');
        }
    }

    _loadUser($) {
        const userLink = $('.topbar-menu-links a');

        const [, , userId, userName] = userLink.attr('href').split('/');

        this._userId = parseInt(userId, 10);
        this._userName = userName;
    }


    // Request helpers
    async _request(method, uri, form, qs) {
        const options = {
            uri,
            method,
            qs,
            form,
            jar: this._cookieJar,
            json: true,
        };

        if (!uri.startsWith('https://')) {
            options.uri = `${this._chatRoot}${uri}`;
        }

        const res = await request(options);

        if (res.statusCode >= 400) {
            throw new ChatExchangeError(`Remote server threw ${res.statusCode} error.`);
        }

        return res;
    }

    async _get$(uri, qs = {}) {
        const res = await this._request('get', uri, {}, qs);

        return cheerio.load(res.body);
    }

    _post(uri, data = {}, qs = {}) {
        return this._request('post', uri, data, qs);
    }

    async _postKeyed(uri, data = {}, qs = {}) {
        data.fkey = await this.chatFKey;

        return this._post(uri, data, qs);
    }

    _getCookie(key) {
        const cookies = this._cookieJar.getCookies(`https://${this.host}`);

        return cookies.find(cookie => cookie.key === key);
    }
}

export default Browser;
