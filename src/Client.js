import Browser from './Browser';
import Room from './Room';
import User from './User';
import InvalidArgumentError from './Exceptions/InvalidArgumentError';

const validHosts = ['stackexchange.com', 'meta.stackexchange.com', 'stackoverflow.com'];

/**
 * Represents the main chatexchange Client class.
 *
 * @class Client
 */
class Client {
    constructor(host) {
        if (typeof host === 'undefined' || host === '') {
            throw new InvalidArgumentError('Host is required.');
        }

        if (!validHosts.includes(host)) {
            throw new InvalidArgumentError(`Invalid host. Must be one of: ${validHosts.join(', ')}`);
        }

        this.host = host;
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
     * @returns {Promise<string>} Request Cookie Jar (Optionally to save to `loginCookie`)
     * @memberof Client
     */
    login(email, password) {
        if (typeof email === 'undefined' || email === '') {
            throw new InvalidArgumentError('Email is required.');
        }

        if (typeof password === 'undefined' || password === '') {
            throw new InvalidArgumentError('Password is required');
        }

        return this._browser.login(email, password);
    }

    /**
     * Attempts to login to stack exchange, using the provided
     * cookie jar string, which was retrieved from the `login`
     * method.
     *
     * @param {string} cookieString A cookie jar string
     * @returns {Promise<void>} A promise representing when login is complete
     * @memberof Browser
     */
    loginCookie(cookieString) {
        if (typeof cookieString !== 'string' || cookieString === '') {
            console.log(typeof cookieString);
            throw new InvalidArgumentError('cookieString is required.');
        }

        return this._browser.loginCookie(cookieString);
    }

    async joinRoom(id) {
        const room = new Room(this, id);

        await room.join();

        return room;
    }
}

export default Client;