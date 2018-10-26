import Browser from './Browser';
import Room from './Room';
import User from './User';
import InvalidArgumentError from './Exceptions/InvalidArgumentError';

const validHosts = ['stackexchange.com', 'meta.stackexchange.com', 'stackoverflow.com'];

class Client {
    constructor(host) {
        if (typeof host === 'undefined' || host === '') {
            throw new InvalidArgumentError('Host is required.');
        }

        if (!validHosts.includes(host)) {
            throw new InvalidArgumentError(`Invalid host. Must be one of: ${validHosts.join(', ')}`);
        }

        this.host = host
        this._browser = new Browser(this.host);

    }

    async getMe() {
        if (!this._browser.loggedIn) {
            throw new Error('Cannot get user, not logged in.');
        }

        return new User(this, await this._browser.userId);
    }

    /**
     * Attempts to login to the stackexchange network
     * with the provided username and password
     *
     * @param {string} email Email
     * @param {string} password Password
     * @returns {Object} Request Cookie Jar (Optionally to save to `loginCookie`)
     * @memberof Client
     */
    login(email, password) {
        if (typeof email === 'undefined' || email === '') {
            throw new InvalidArgumentError('Email is required.');
        }

        if (typeof password === 'undefined' || password === '') {
            throw new InvalidArgumentError('Password is required');
        }

        return this._browser.login(email, password)
    }

    loginCookieJar(cookieJar) {
        if (typeof cookieJar === 'undefined' || cookieJar === '') {
            throw new InvalidArgumentError('cookieJar is required.');
        }

        return this._browser.loginCookieJar(cookieJar);
    }

    async joinRoom(id) {
        const room = new Room(this, id);

        await room.join();

        return room;
    }
}

export default Client