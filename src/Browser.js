import { default as requestPromise } from 'request-promise-native';
import cheerio from 'cheerio';
import WebSocket from 'ws';
import ChatExchangeError from './Exceptions/ChatExchangeError';
import LoginError from './Exceptions/LoginError';

const lazy = async (getter, updater) => {
    let result = getter();
    if (typeof result !== 'undefined') {
        return result;
    }

    await updater();

    result = getter();

    if (typeof result === 'undefined') {
        throw new ChatExchangeError('Unable to find field.');
    }

    return result;
};

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

    async loginCookieJar(acct) {
        // this._cookieJar.setCookie(`acct=${acct}`, `https://${this.host}`, {
        //     httpOnly: true,
        //     secure: true,
        //     hostOnly: false,
        // });
        
        const $ = await this.get$(`https://${this.host}/`);

        const res = $('.my-profile');

        if (res.length === 0) {
            throw new LoginError('Login with acct string could not be verified, ' +
                'try credential login instead.');
        }
    }

    async login(email, password) {
        const $ = await this.get$(`https://${this.host}/users/login`);

        const fkey = $('input[name="fkey"]').val();

        if (typeof fkey === 'undefined') {
            throw new ChatExchangeError('Unable to find fkey element on /users/login');
        }

        await this.post(`https://${this.host}/users/login`, {
            fkey,
            email,
            password,
        }, {});

        const acctCookie = this.getCookie('acct');

        if (typeof acctCookie === 'undefined') {
            throw new LoginError('failed to get acct cookie from Stack Exchange OpenID, ' +
                'check credentials provided for accuracy');
        }

        this.loggedIn = true

        return acctCookie.value;
    }

    async joinRoom(id) {
        const res = await this.postKeyed(`chats/${id}/events`, {
            since: 0,
            mode: 'Messages',
            msgCount: 100,
        });

        this._rooms[id] = {
            eventtime: res.body.time,
        };
    }

    async watchRoom(id) {
        const wsAuthData = await this.postKeyed('ws-auth', {
            roomid: id,
        });

        const wsUrl = `${wsAuthData.body.url}?l=${this._rooms[id].eventtime}`;

        const ws = new WebSocket(wsUrl, {
            origin: this._chatRoot,
        });

        return ws;
    }

    async getProfile(userId) {
        const $ = await this.get$(`users/${userId}`);

        const name = $('h1').text();
        const isModerator = $('.user-status')[0].text().includes('♦');

        return {
            name,
            isModerator,
        };
    }

    sendMessage(roomId, text) {
        return this.postKeyed(`chats/${roomId}/messages/new`, {
            text,
        });
    }

    async _updateChatFKeyAndUser() {
        const $ = await this.get$('chats/join/favorite');

        this._loadFKey($);
        this._loadUser($);

        return this._fkey;
    }

    _loadFKey($) {
        this._chatFKey = $('input[name="fkey"]').val();

        if (typeof this._chatFKey === 'undefined') {
            throw new ChatExchangeError('Unable to find fkey.');
        }
    }

    _loadUser($) {
        const userLink = $('.topbar-menu-links a');

        const [, , userId, userName] = userLink.attr('href').split('/');

        this._userId = parseInt(userId, 10);
        this._userName = userName;
    }


    // Request helpers
    _request(method, uri, form, qs) {
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

        return request(options);
    }

    async get$(uri, qs = {}) {
        const res = await this._request('get', uri, {}, qs);

        return cheerio.load(res.body);
    }

    post(uri, data = {}, qs = {}) {
        return this._request('post', uri, data, qs);
    }

    async postKeyed(uri, data = {}, qs = {}) {
        data.fkey = await this.chatFKey;

        return this.post(uri, data, qs);
    }

    getCookie(key) {
        const cookies = this._cookieJar.getCookies(`https://${this.host}`);

        return cookies.find(cookie => cookie.key === key);
    }
}

export default Browser;