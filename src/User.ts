import { IProfileData } from "./Browser";
import Client, { Host } from "./Client";
import { lazy } from "./utils";

/**
 * Represents a user. Most properties are promises, to
 * lazily load them from the server if they're not present.
 *
 * @class User
 */
class User {

    #client: Client;
    #profileData?: Omit<Partial<IProfileData>, "id">;

    /**
     * @param {Client} client
     * @param {number} id The id of the user
     *
     */
    constructor(
        client: Client,
        public id: number,
        profileData?: Omit<Partial<IProfileData>, "id">
    ) {
        this.#client = client;
        this.#profileData = profileData;
    }

    /**
     * The name of the user
     *
     * @readonly
     * @type {Promise<string>}
     * @memberof User
     */
    get name(): Promise<string> {
        return lazy(
            () => this.#profileData?.name,
            () => this.scrapeProfile()
        );
    }

    /**
     * The about section of their chat profile
     *
     * @readonly
     * @type {Promise<string>}
     * @memberof User
     */
    get about(): Promise<string> {
        return lazy(
            () => this.#profileData?.about,
            () => this.scrapeProfile()
        );
    }

    /**
     * True if the user is a moderator, false otherwise
     *
     * @readonly
     * @type {Promise<boolean>}
     * @memberof User
     */
    get isModerator(): Promise<boolean> {
        return lazy(
            () => this.#profileData?.isModerator,
            () => this.scrapeProfile()
        );
    }

    /**
     * The number of all time messages this user has sent
     *
     * @readonly
     * @type {Promise<number>}
     * @memberof User
     */
    get messageCount(): Promise<number> {
        return lazy(
            () => this.#profileData?.messageCount,
            () => this.scrapeProfile()
        );
    }

    /**
     * All time number of rooms this user has been a part of
     *
     * @readonly
     * @type {Promise<number>}
     * @memberof User
     */
    get roomCount(): Promise<number> {
        return lazy(
            () => this.#profileData?.roomCount,
            () => this.scrapeProfile()
        );
    }

    /**
     * The number of seconds since this user was last seen
     *
     * @readonly
     * @type {Promise<number>}
     * @memberof User
     */
    get lastSeen(): Promise<number> {
        return lazy(
            () => this.#profileData?.lastSeen,
            () => this.scrapeProfile()
        );
    }

    /**
     * The number of seconds since this user posted a message in any chat
     *
     * @readonly
     * @type {Promise<number>}
     * @memberof User
     */
    get lastMessage(): Promise<number> {
        return lazy(
            () => this.#profileData?.lastMessage,
            () => this.scrapeProfile()
        );
    }

    /**
     * User's current reputation
     *
     * @readonly
     * @type {Promise<number>}
     * @memberof User
     */
    get reputation(): Promise<number> {
        return lazy(
            () => this.#profileData?.reputation,
            () => this.scrapeProfile()
        );
    }

    /**
     * @summary gets this {@link User}'s parent info
     * @readonly
     */
    get parent(): Promise<{ id?: number, host?: Host, site?: string; }> {
        return lazy(
            () => {
                const profile = this.#profileData;
                if (!profile) return;

                const { parentHost, parentId, parentSite } = profile;

                return { id: parentId, host: parentHost, site: parentSite };
            },
            () => this.scrapeProfile()
        );
    }

    /**
     * Used by most properties of this class to fetch their profile,
     * and updates their associated values. This should not be needed
     * to call directly. Simply await the properties
     *
     * @returns {Promise<void>}
     * @memberof User#
     */
    public async scrapeProfile(): Promise<void> {
        this.#profileData = await this.#client.getProfile(this);
    }
}

export default User;
