import Client from "../../src/Client";

jest.mock("got", () => {
    const fn = jest.fn(async (url) => {
        const fs = await import("fs/promises");

        const common = { encoding: "utf-8" } as const;

        switch (url) {
            case "https://stackoverflow.com/users/login":
                return {
                    statusCode: 200,
                    body: await fs.readFile("./tests/mocks/login.html", common),
                };
            case "https://chat.stackoverflow.com/chats/join/favorite":
                return {
                    statusCode: 200,
                    body: await fs.readFile(
                        "./tests/mocks/favorite.html",
                        common
                    ),
                };
            case "https://chat.stackoverflow.com/chats/5/events":
                return {
                    statusCode: 200,
                    body: { time: 1234 },
                };
            case "https://chat.stackoverflow.com/users/10162108":
                return {
                    statusCode: 200,
                    body: await fs.readFile("./tests/mocks/profiles/spot.html"),
                };
        }
    });

    return Object.assign(fn, {
        extend: () => fn,
    });
});

jest.mock("tough-cookie", () => {
    class CookieJar {
        getCookies() {
            return [{ key: "acct", value: "sample" }];
        }
    }

    return {
        CookieJar,
        deserializeSync: () => new CookieJar(),
    };
});

describe("Login", () => {
    test("Verify User Information Found", async () => {
        expect.assertions(3);
        const client = new Client("stackoverflow.com");

        await client.login("test@test.com", "testpassword");

        const { name, id } = client.getUser(10162108);
        const { fkey } = client;

        expect(await fkey).toEqual("abc3a168fb58f83bb158d796b2d21c79");
        expect(await name).toEqual("SpotDetector");
        expect(id).toEqual(10162108);
    });

    test("Verify attempts to join room", async () => {
        expect.assertions(2);
        const client = new Client("stackoverflow.com");

        const roomId = 5;

        await client.login("test@test.com", "testpassword");
        await client.joinRoom(roomId);

        const room = client.getRoom(roomId);
        expect(room).not.toBeUndefined();
        expect(room.id).toEqual(roomId);
    });

    // For testing branches (Promise being called for userId/UserName)
    // these are required
    test("Verify Username Found", async () => {
        expect.assertions(1);
        const client = new Client("stackoverflow.com");

        await client.login("test@test.com", "testpassword");

        const { name } = client.getUser(10162108);
        expect(await name).toEqual("SpotDetector");
    });

    test("Verify UserId Found", async () => {
        expect.assertions(1);
        const client = new Client("stackoverflow.com");

        await client.login("test@test.com", "testpassword");

        const { id } = client.getUser(10162108);
        expect(id).toEqual(10162108);
    });
});
