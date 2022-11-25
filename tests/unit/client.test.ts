import Browser, {
    DeleteMessageStatus,
    type IRoomSave,
} from "../../src/Browser";
import Client, { AllowedHosts, isAllowedHost } from "../../src/Client";
import ChatExchangeError from "../../src/Exceptions/ChatExchangeError";
import InvalidArgumentError from "../../src/Exceptions/InvalidArgumentError";
import Message from "../../src/Message";
import Room from "../../src/Room";
import User from "../../src/User";
import createRoomBody from "../fixtures/create_room_body.json";
import updateRoomBody from "../fixtures/update_room_body.json";
import { makeMockClassExport } from "./utils";

const mockBrowser = makeMockClassExport<Browser>("../../src/Browser");
const mockClient = makeMockClassExport<Client>("../../src/Client");
const mockRoom = makeMockClassExport<Room>("../../src/Room");

describe(Client.name, () => {
    beforeEach(() => jest.resetModules());

    describe("Instantiation", () => {
        test("Should throw error if invalid host", () => {
            expect.assertions(1);

            //@ts-ignore
            expect(() => new Client("example.com")).toThrowError(
                InvalidArgumentError
            );
        });

        test("Should throw error if not logged in", async () => {
            expect.assertions(1);

            await expect(
                new Client("stackoverflow.com").getMe()
            ).rejects.toThrowError(ChatExchangeError);
        });
    });

    describe("Getters", () => {
        test("Should correctly get root", () => {
            expect.assertions(1);

            const clients = AllowedHosts.map((host) => new Client(host));
            const roots = clients.map(({ root }) => root);

            expect(roots).toEqual([
                "https://chat.stackexchange.com/",
                "https://chat.meta.stackexchange.com/",
                "https://chat.stackoverflow.com/",
            ]);
        });

        test("Should correctly get fkey", async () => {
            expect.assertions(1);

            const mockFkey = "42";

            mockBrowser({ chatFKey: Promise.resolve(mockFkey) });
            const { default: Browser } = await import("../../src/Browser");

            const client = new Client("stackexchange.com");
            client.browser = new Browser(client);

            await expect(client.fkey).resolves.toEqual(mockFkey);
        });
    });

    describe("Rooms", () => {
        test("Should add rooms to the internal list of rooms when requested", () => {
            const client = new Client("stackexchange.com");

            const room1Id = 42;
            const room2Id = 24;

            client.getRoom(room1Id);
            client.getRoom(new Room(client, room2Id));

            const rooms = client.getRooms();

            expect(rooms.size).toEqual(2);
            expect(rooms.get(room1Id)?.id).toEqual(room1Id);
            expect(rooms.get(room2Id)?.id).toEqual(room2Id);
        });

        describe(Client.prototype.listUsers.name, () => {
            test("Should correctly list users", async () => {
                expect.assertions(2);

                const client = new Client("stackexchange.com");

                mockBrowser({
                    listUsers: () => Promise.resolve([new User(client, 42)]),
                });
                const { default: Browser } = await import("../../src/Browser");

                client.browser = new Browser(client);

                const users = await client.listUsers(42);

                expect(users.length).toEqual(1);
                expect(users[0].id).toEqual(42);
            });
        });

        describe(Client.prototype.joinRoom.name, () => {
            test("Should correctly join rooms", async () => {
                expect.assertions(1);

                mockBrowser({ joinRoom: () => Promise.resolve(true) });
                const { default: Browser } = await import("../../src/Browser");

                const client = new Client("stackoverflow.com");
                client.browser = new Browser(client);
                const room = client.getRoom(5);

                await expect(room.join()).resolves.toBe(true);
            });
        });

        describe(Client.prototype.leaveRoom.name, () => {
            test("Should correctly leave rooms", async () => {
                expect.assertions(1);

                mockBrowser({ leaveRoom: () => Promise.resolve(true) });
                const { default: Browser } = await import("../../src/Browser");

                const client = new Client("meta.stackexchange.com");
                client.browser = new Browser(client);
                await client.joinRoom(42);

                const status = await client.leaveRoom(42);
                expect(status).toBe(true);
            });

            test("Should return false on failure", async () => {
                expect.assertions(1);

                mockBrowser({ leaveRoom: () => Promise.resolve(false) });
                const { default: Browser } = await import("../../src/Browser");

                const client = new Client("meta.stackexchange.com");
                client.browser = new Browser(client);
                await client.joinRoom(42);

                const status = await client.leaveRoom(42);
                expect(status).toBe(false);
            });
        });

        describe(Client.prototype.leaveAll.name, () => {
            test("Should correctly leave all rooms", async () => {
                expect.assertions(1);

                mockBrowser({
                    joinRoom: () => Promise.resolve(true),
                    leaveRoom: () => Promise.resolve(true),
                });
                const { default: Browser } = await import("../../src/Browser");

                const client = new Client("meta.stackexchange.com");
                client.browser = new Browser(client);
                await client.joinRoom(42);

                const status = await client.leaveAll();
                expect(status).toBe(true);
            });
        });

        describe(Client.prototype.createRoom.name, () => {
            test("Should correctly create rooms", async () => {
                expect.assertions(1);

                mockBrowser({ createRoom: () => Promise.resolve(42) });
                const { default: Browser } = await import("../../src/Browser");

                const client = new Client("meta.stackexchange.com");
                client.browser = new Browser(client);

                const room = await client.createRoom(
                    createRoomBody as IRoomSave
                );

                expect(room.id).toBe(42);
            });
        });

        describe(Client.prototype.updateRoom.name, () => {
            test("should correctly update rooms", async () => {
                expect.assertions(1);

                mockBrowser({ updateRoom: () => Promise.resolve(42) });
                const { default: Browser } = await import("../../src/Browser");

                const client = new Client("meta.stackexchange.com");
                client.browser = new Browser(client);

                const room = await client.updateRoom(
                    42,
                    updateRoomBody as IRoomSave
                );

                expect(room.id).toBe(42);
            });
        });

        describe(Client.prototype.broadcast.name, () => {
            test("should return a status map of roomId -> status", async () => {
                expect.assertions(2);

                const mockSend = jest.fn();

                mockRoom({ sendMessage: mockSend });

                const { default: Client } = await import("../../src/Client");
                const client = new Client("meta.stackexchange.com");

                const fineId = 42;
                const brokenId = 24;

                client.getRoom(fineId);
                client.getRoom(brokenId);

                mockSend
                    .mockResolvedValueOnce(void 0)
                    .mockRejectedValueOnce(void 0);

                const statusMap = await client.broadcast(
                    "BBC wants to apologize for the following"
                );

                expect(statusMap.get(fineId)).toBe(true);
                expect(statusMap.get(brokenId)).toBe(false);
            });
        });
    });

    describe("Login", () => {
        describe(Client.prototype.login.name, () => {
            test("Should throw if missing email", async () => {
                expect.assertions(1);
    
                await expect(
                    new Client("stackoverflow.com").login("", "abc123")
                ).rejects.toThrowError(InvalidArgumentError);
            });

            test("Should throw if missing password", async () => {
                expect.assertions(1);
    
                await expect(
                    new Client("stackoverflow.com").login("text@example.com", "")
                ).rejects.toThrowError(InvalidArgumentError);
            });

            test("Should throw if email is invalid", async () => {
                expect.assertions(1);
    
                await expect(
                    new Client("stackexchange.com").login("invalid", "a12B$")
                ).rejects.toThrowError(InvalidArgumentError);
            });
        });

        describe(Client.prototype.loginCookie.name, () => {
            test("Should throw error if invalid cookieString", async () => {
                expect.assertions(1);
    
                await expect(
                    new Client("stackoverflow.com").loginCookie("")
                ).rejects.toThrowError(InvalidArgumentError);
            });
    
            test("Should attempt to login with a cookieString", async () => {
                expect.assertions(2);
    
                const loginCookieMock = jest.fn();
    
                mockBrowser({ loginCookie: loginCookieMock });
                const { default: Browser } = await import("../../src/Browser");
    
                const client = new Client("stackoverflow.com");
                client.browser = new Browser(client);
    
                const cookieStr = "testing";
    
                await client.loginCookie(cookieStr);
    
                expect(loginCookieMock).toHaveBeenCalledTimes(1);
                expect(loginCookieMock).toHaveBeenLastCalledWith(cookieStr);
            });
        });
    });

    describe("Messages", () => {
        describe(Client.prototype.delete.name, () => {
            test("Should correctly attempt to delete a message", async () => {
                expect.assertions(1);

                mockBrowser({
                    deleteMessage: () =>
                        Promise.resolve(DeleteMessageStatus.SUCCESS),
                });
                const { default: Browser } = await import("../../src/Browser");

                const client = new Client("meta.stackexchange.com");
                client.browser = new Browser(client);
                const status = await client.delete(42);

                expect(status).toEqual(DeleteMessageStatus.SUCCESS);
            });
        });

        describe(Client.prototype.getMessage.name, () => {
            test("Should return a Message on 'getMessage'", () => {
                expect.assertions(2);

                const client = new Client("meta.stackexchange.com");

                const id = 29;

                const msg = client.getMessage(id);

                expect(msg).toBeInstanceOf(Message);
                expect(msg.id).toEqual(id);
            });
        });
    });

    describe("Users", () => {
        describe(Client.prototype.getMe.name, () => {
            test("Should return the logged in user", async () => {
                expect.assertions(1);
    
                const userId = 5;
    
                mockBrowser({ userId: Promise.resolve(userId) });
                const { default: Browser } = await import("../../src/Browser");
    
                mockClient({ loggedIn: true });
                const { default: Client } = await import("../../src/Client");
    
                const client = new Client("stackoverflow.com");
                client.browser = new Browser(client);
                const user = await client.getMe();
    
                expect(user.id).toEqual(userId);
            });
        });

        describe(Client.prototype.getUser.name, () => {
            test("Should return a User on 'getUser'", async () => {
                expect.assertions(2);

                const client = new Client("meta.stackexchange.com");

                const id = 5;

                const user = client.getUser(id);

                expect(user).toBeInstanceOf(User);
                expect(user.id).toEqual(id);
            });
        });
    });
});

describe("Hosts", () => {
    beforeEach(() => jest.resetModules());

    describe(isAllowedHost.name, () => {
        test("Should correctly determine if a host is allowed", () => {
            expect.assertions(1 + AllowedHosts.length);

            const notAllowed = isAllowedHost("example.com");
            expect(notAllowed).toEqual(false);

            AllowedHosts.forEach((host) => {
                const allowed = isAllowedHost(host);
                expect(allowed).toEqual(true);
            });
        });
    });
});
