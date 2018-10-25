/* eslint-disable no-underscore-dangle */
class User {
    get name() {
        return this.scrapeProfile('name');
    }

    constructor(client, id) {
        this._client = client;
        this.id = id;
    }

    async scrapeProfile(field) {
        if (typeof this[`_${field}`] !== 'undefined') {
            return this[`_${field}`];
        }

        const profile = await this._client._browser.getProfile(this.id);

        this._name = profile.name;

        return this[`_${field}`];
    }
}

export default User;