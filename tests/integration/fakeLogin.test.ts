import fs from "fs/promises";
import Client from "../../src/Client";
import LoginError from "../../src/Exceptions/LoginError";

jest.mock("got", () => {
    const fn = jest.fn((url: string) => {
        const resMap: Record<
            string,
            () => Promise<{ statusCode: number; body: string }>
        > = {
            "https://stackoverflow.com/users/login": async () => ({
                statusCode: 200,
                body: await fs.readFile("./tests/mocks/login.html", {
                    encoding: "utf-8",
                }),
            }),
        };
        return resMap[url]();
    });

    return Object.assign(fn, { extend: () => fn });
});

describe("Login Failures", () => {
    test("Should fail with login error", async () => {
        expect.assertions(1);

        const client = new Client("stackoverflow.com");

        await expect(
            client.login("test@test.com", "P@ssw0rd")
        ).rejects.toThrowError(LoginError);
    });
});
