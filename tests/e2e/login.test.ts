import dotenv from "dotenv";
import Client from "../../src/Client";
import Room from "../../src/Room";

dotenv.config();

describe("Real Site Login", () => {
    const { SE_EMAIL, SE_PASSWORD, TEST_ROOM_ID } = process.env;

    const hasCreds = SE_EMAIL && SE_PASSWORD;
    const testIf = hasCreds ? test : test.skip;
    const skipLog = hasCreds ? test.skip : test;

    skipLog("", () => console.log("Can't run E2E tests without credentials"));

    // avoids hitting login as much as possible
    let sharedCookie: string;

    testIf("Should login with credentials", async () => {
        expect.assertions(2);
        const client = new Client("stackoverflow.com");

        const cookie = await client.login(SE_EMAIL!, SE_PASSWORD!);

        sharedCookie = cookie;

        const user = await client.getMe();
        expect(user.id).toBeTruthy();

        // Login with a new client, via cookie
        const client2 = new Client("stackoverflow.com");

        await client2.loginCookie(cookie);

        const user2 = await client2.getMe();
        expect(user2.id).toEqual(user.id);
    });

    testIf("Should join room after logging in", async () => {
        expect.assertions(1);

        const client = new Client("stackoverflow.com");
        await client.loginCookie(sharedCookie);

        await expect(client.joinRoom(+TEST_ROOM_ID!)).resolves.toBeInstanceOf(
            Room
        );
    });

    testIf("Should watch room after joining", async () => {
        expect.assertions(1);

        const client = new Client("stackoverflow.com");
        await client.loginCookie(sharedCookie);
        const room = await client.joinRoom(+TEST_ROOM_ID!);

        const roomWatched = await room.watch();

        expect(roomWatched).toBeInstanceOf(Room);

        await room.leave();
    });
});
