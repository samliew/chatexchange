import Browser from './Browser';
import Room from './Room';
import User from './User';

const validHosts = ['stackexchange.com', 'meta.stackexchange.com', 'stackoverflow.com'];

class Client {
    constructor(host) {
        if (typeof host === 'undefined' || host === '') {
            throw new Error('Host is required.');
        }

        if (!validHosts.includes(host)) {
            throw new Error(`Invalid host. Must be one of: ${validHosts.join(', ')}`);
        }

        this.host = host
        this._browser = new Browser(this.host);

    }

    getMe() {
        if (typeof this._browser.userId === 'undefined') {
            throw new Error('Cannot get user, not logged in.');
        }

        return new User(this, this._browser.userId);
    }

    login(email, password) {
        if (typeof email === 'undefined' || email === '') {
            throw new Error('Email is required.');
        }

        if (typeof password === 'undefined' || password === '') {
            throw new Error('Password is required');
        }

        return this._browser.login(email, password)
    }

    loginAcct(acct) {
        if (typeof acct === 'undefined' || acct === '') {
            throw new Error('Acct string is required.');
        }

        return this._browser.loginAcct(acct);
    }

    async joinRoom(id) {
        const room = new Room(this, id);

        await room.join();

        return room;
    }
}

export default Client