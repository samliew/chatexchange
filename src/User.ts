import Client from "./Client";
import { lazy } from "./utils";

/* eslint-disable no-underscore-dangle */

interface UserPrivates {
    client: Client;
    name?: string;
    about?: string;
    isModerator?: boolean;
    messageCount?: number;
    roomCount?: number;
    lastSeen?: number;
    lastMessage?: number;
    reputation?: number;
}

const privates: WeakMap<User, UserPrivates> = new WeakMap();

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
 * @property {Promise<number>} reputation user's reputation
 * @class User
 */
class User {
    constructor(client: Client, public id: number) {
        privates.set(this, { client });
    }

    get name() {
        return lazy(
            () => privates.get(this)!.name,
            () => this.scrapeProfile()
        );
    }

    get about() {
        return lazy(
            () => privates.get(this)!.about,
            () => this.scrapeProfile()
        );
    }

    get isModerator() {
        return lazy(
            () => privates.get(this)!.isModerator,
            () => this.scrapeProfile()
        );
    }

    get messageCount() {
        return lazy(
            () => privates.get(this)!.messageCount,
            () => this.scrapeProfile()
        );
    }

    get roomCount() {
        return lazy(
            () => privates.get(this)!.roomCount,
            () => this.scrapeProfile()
        );
    }

    get lastSeen() {
        return lazy(
            () => privates.get(this)!.lastSeen,
            () => this.scrapeProfile()
        );
    }

    get lastMessage() {
        return lazy(
            () => privates.get(this)!.lastMessage,
            () => this.scrapeProfile()
        );
    }

    get reputation() {
        return lazy(
            () => privates.get(this)!.reputation,
            () => this.scrapeProfile()
        );
    }

    /**
     * Used by most properties of this class to fetch their profile,
     * and updates their associated values.
     *
     * @returns {Promise<void>}
     * @memberof User
     */
    public async scrapeProfile(): Promise<void> {
        const user = privates.get(this)!;
        const data = await user.client._browser.getProfile(this.id);
        privates.set(this, Object.assign(user, data));
    }
}

export default User;
