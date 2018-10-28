import { lazy } from './utils';

/* eslint-disable no-underscore-dangle */

/**
 * Represents a user. Most properties are promises, to
 * lazily load them from the server if they're not present.
 *
 * @property {number} id The id of the user
 * @property {Promise<string>} name The name of the user
 * @property {Promise<string>} about The about section of their chat profile
 * @property {Promise<boolean>} isModerator True if the user is a moderator, false otherwise
 * @property {Promise<number>} messageCount The number of all time messages this user has sent
 * @property {Promise<number>} roomCount All time number of rooms this user has been a part of
 * @property {Promise<number>} lastSeen The number of seconds since this user was last seen
 * @property {Promise<number>} lastMessage The number of seconds since this user posted a message in any chat
 * 
 * @class User
 */
class User {
    constructor(client, id) {
        this._client = client;
        this.id = id;
    }

    get name() {
        return lazy(() => this._name, () => this.scrapeProfile());
    }

    get about() {
        return lazy(() => this._about, () => this.scrapeProfile());
    }

    get isModerator() {
        return lazy(() => this._isModerator, () => this.scrapeProfile());
    }

    get messageCount() {
        return lazy(() => this._messageCount, () => this.scrapeProfile());
    }

    get roomCount() {
        return lazy(() => this._roomCount, () => this.scrapeProfile());
    }

    get lastSeen() {
        return lazy(() => this._lastSeen, () => this.scrapeProfile());
    }

    get lastMessage() {
        return lazy(() => this._lastMessage, () => this.scrapeProfile());
    }

    /**
     * Used by most properties of this class to fetch their profile,
     * and updates their associated values.
     * 
     * @returns {void}
     * @memberof User
     */
    async scrapeProfile() {
        const data = await this._client._browser.getProfile(this.id);

        this._name = data.name;
        this._about = data.about;
        this._isModerator = data.isModerator;
        this._messageCount = data.messageCount;
        this._roomCount = data.roomCount;
        this._lastSeen = data.lastSeen;
        this._lastMessage = data.lastMessage;
    }
}

export default User;
