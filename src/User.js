/* eslint-disable no-underscore-dangle */
class User {
    get name() {
        return this.scrapeProfile('name');
    }

    constructor(client, id) {
        this._client = client;
        this.id = id;
    }
}

export default User;