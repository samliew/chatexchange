import Browser from './Browser';
import Room from './Room';
import User from './User';
import InvalidArgumentError from './Exceptions/InvalidArgumentError';
import ChatExchangeError from './Exceptions/ChatExchangeError';

const validHosts = ['stackexchange.com', 'meta.stackexchange.com', 'stackoverflow.com'];

/**
 * Represents the main chatexchange Client class.
 * @class
 */
class Client {

    /**
     * Creates an instance of Client.
     * 
     * @param {string} host The host to connect to (stackexchange.com, meta.stackexchange.com, or stackoverflow.com)
     * @throws {InvalidArgumentError} If the host is invalid
     * @constructor
     */
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

    /**
     * Fetches the current logged-in user's profile
     *
     * @returns {Promise<User>} The user object
     * @throws {ChatExchangeError} If no user is currently logged in
     * @memberof Client
     */
    async getMe() {
        if (!this._browser.loggedIn) {
            throw new ChatExchangeError('Cannot get user, not logged in.');
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
    async login(email, password) {
        if (typeof email === 'undefined' || email === '') {
            throw new InvalidArgumentError('Email is required.');
        }

        if (typeof password === 'undefined' || password === '') {
            throw new InvalidArgumentError('Password is required');
        }

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
    async loginCookie(cookieString) {
        if (typeof cookieString !== 'string' || cookieString === '') {
            throw new InvalidArgumentError('cookieString is required.');
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
    async joinRoom(id) {
        const room = new Room(this, id);

        await room.join();

        return room;
    }
}

export default Client;
