import { IProfileData } from "./Browser";
import Client from "./Client";
import { lazy } from "./utils";

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
    #client: Client;
    #profileData?: IProfileData;

    constructor(client: Client, public id: number) {
        this.#client = client
    }

    get name(): Promise<string> {
        return lazy(
            () => this.#profileData?.name,
            () => this.scrapeProfile()
        );
    }

    get about(): Promise<string> {
        return lazy(
            () => this.#profileData?.about,
            () => this.scrapeProfile()
        );
    }

    get isModerator(): Promise<boolean> {
        return lazy(
            () => this.#profileData?.isModerator,
            () => this.scrapeProfile()
        );
    }

    get messageCount(): Promise<number> {
        return lazy(
            () => this.#profileData?.messageCount,
            () => this.scrapeProfile()
        );
    }

    get roomCount(): Promise<number> {
        return lazy(
            () => this.#profileData?.roomCount,
            () => this.scrapeProfile()
        );
    }

    get lastSeen(): Promise<number> {
        return lazy(
            () => this.#profileData?.lastSeen,
            () => this.scrapeProfile()
        );
    }

    get lastMessage(): Promise<number> {
        return lazy(
            () => this.#profileData?.lastMessage,
            () => this.scrapeProfile()
        );
    }

    get reputation(): Promise<number> {
        return lazy(
            () => this.#profileData?.reputation,
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
        this.#profileData = await this.#client._browser.getProfile(this.id);
    }
}

export default User;
