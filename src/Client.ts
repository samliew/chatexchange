import Browser from "./Browser";
import ChatExchangeError from "./Exceptions/ChatExchangeError";
import InvalidArgumentError from "./Exceptions/InvalidArgumentError";
import Message from "./Message";
import Room from "./Room";
import User from "./User";

export type Host =
  | "stackexchange.com"
  | "meta.stackexchange.com"
  | "stackoverflow.com";

export const AllowedHosts: Host[] = [
  "stackoverflow.com",
  "stackexchange.com",
  "meta.stackexchange.com",
];

/**
 * Represents the main chatexchange Client class.
 * @class
 */
class Client {
  /**
   * The host to connect to (stackexchange.com, meta.stackexchange.com, or stackoverflow.com)
   *
   * @type {string}
   * @memberof Client
   */
  public host: string;
  public _browser: Browser;
  private _rooms: Map<number, Room>;
  private _users: Map<number, User>;

  /**
   * Creates an instance of Client.
   *
   * @param {string} host The host to connect to (stackexchange.com, meta.stackexchange.com, or stackoverflow.com)
   * @throws {InvalidArgumentError} If the host is invalid
   * @constructor
   */
  constructor(host: Host) {
    if (!AllowedHosts.includes(host)) {
      throw new InvalidArgumentError(
        `Invalid host. Must be one of ${AllowedHosts.join(", ")}`
      );
    }

    this.host = host;
    this._browser = new Browser(this, this.host);
    this._rooms = new Map<number, Room>();
    this._users = new Map<number, User>();
  }

  /**
   * Fetches the current logged-in user's profile
   *
   * @returns {Promise<User>} The user object
   * @throws {ChatExchangeError} If no user is currently logged in
   * @memberof Client
   */
  public async getMe() {
    if (!this._browser.loggedIn) {
      throw new ChatExchangeError("Cannot get user, not logged in.");
    }

    return new User(this, await this._browser.userId);
  }

  public getMessage(id: number) {
    // eslint-disable-line class-methods-use-this
    // Add caching in the future?
    return new Message(this, id);
  }

  public getRoom(id: number) {
    let room = this._rooms.get(id);
    if (room) {
      return room;
    }

    room = new Room(this, id);

    this._rooms.set(id, room);

    return room;
  }

  public getUser(id: number) {
    let user = this._users.get(id);
    if (user) {
      return user;
    }

    user = new User(this, id);

    this._users.set(id, user);

    return user;
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
  public async login(email: string, password: string) {
    if (typeof email === "undefined" || email === "") {
      throw new InvalidArgumentError("Email is required.");
    }

    if (typeof password === "undefined" || password === "") {
      throw new InvalidArgumentError("Password is required");
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
  public async loginCookie(cookieString: string) {
    if (typeof cookieString !== "string" || cookieString === "") {
      throw new InvalidArgumentError("cookieString is required.");
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
  public async joinRoom(id: number) {
    const room = this.getRoom(id);

    await room.join();

    return room;
  }
}

export default Client;
