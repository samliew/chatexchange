import { default as requestPromise } from 'request-promise-native';
import requestDebug from 'request-debug';
import cheerio from 'cheerio';
import WebSocket from 'ws';

requestDebug(requestPromise);

const request = requestPromise.defaults({
    gzip: true,
    simple: false,
    resolveWithFullResponse: true,
    followRedirect: false,
    headers: {
        'User-Agent': 'Node.js/ChatExchange',
    },
});

class Browser {

    constructor(host) {
        this.host = host;
        this._cookieJar = request.jar();
        this._chatRoot = `https://chat.${this.host}/`;
        this._rooms = {};
    }

    async chatFKey() {
        if (typeof this._fkey !== 'undefined') {
            return this._fkey;
        }

        const $ = await this.get$('chats/join/favorite');

        this._loadFKey($);
        this._loadUser($)

        return this._fkey;
    }

    async loginAcct(acct) {
        this._cookieJar.setCookie(`acct=${acct}`, `https://${this.host}`, {
            httpOnly: true,
            secure: true,
            hostOnly: false,
        });
        
        const $ = await this.get$(`https://${this.host}/`);

        const res = $('.my-profile');

        if (res.length === 0) {
            throw new Error('Login with acct string could not be verified, ' +
                'try credential login instead.');
        }
    }

    async login(email, password) {
        const $ = await this.get$(`https://${this.host}/users/login`);

        const fkey = $('input[name="fkey"]').val();

        if (typeof fkey === 'undefined') {
            throw new Error('Unable to find fkey element on /users/login');
        }

        await this.post(`https://${this.host}/users/login`, {
            fkey,
            email,
            password,
        }, {});

        const acctCookie = this.getCookie('acct');

        if (typeof acctCookie === 'undefined') {
            throw new Error('failed to get acct cookie from Stack Exchange OpenID, ' +
                'check credentials provided for accuracy');
        }

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

        console.log('Connecting to', wsUrl);

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

    _loadFKey($) {
        this._fkey = $('input[name="fkey"]').val();

        if (typeof this._fkey === 'undefined') {
            throw new Error('Unable to find fkey.');
        }
    }

    _loadUser($) {
        const userLink = $('.topbar-menu-links a');

        const [, , userId, userName] = userLink.attr('href').split('/');

        this.userId = parseInt(userId, 10);
        this.userName = userName;
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
        data.fkey = await this.chatFKey();

        return this.post(uri, data, qs);
    }

    getCookie(key) {
        const cookies = this._cookieJar.getCookies(`https://${this.host}`);

        return cookies.find(cookie => cookie.key === key);
    }
}

export default Browser;