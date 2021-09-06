import dotenv from "dotenv";
import Client from "../../src/Client";

dotenv.config();

describe("Real Site Login", () => {
    const hasCreds = process.env.SE_EMAIL && process.env.SE_PASSWORD;

    const testIf = hasCreds ? test : test.skip;
    const skipLog = hasCreds ? test.skip : test;

    skipLog("", () => console.log("Can't run E2E tests without credentials"));

    testIf("Should login with credentials", async () => {
        expect.assertions(2);
        const client = new Client("stackoverflow.com");

        const { SE_EMAIL, SE_PASSWORD } = process.env;

        const cookie = await client.login(SE_EMAIL!, SE_PASSWORD!);

        const user = await client.getMe();
        expect(user.id).toBeTruthy();

        // Login with a new client, via cookie
        const client2 = new Client("stackoverflow.com");

        await client2.loginCookie(cookie);

        const user2 = await client2.getMe();
        expect(user2.id).toEqual(user.id);
    });
});
