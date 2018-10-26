/* eslint-disable no-underscore-dangle */

/**
 * Represents a user
 *
 * @property {number} id The id of the user
 * @class User
 */
class User {
    constructor(client, id) {
        this._client = client;
        this.id = id;
    }
}

export default User;