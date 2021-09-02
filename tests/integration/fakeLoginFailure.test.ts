import Client from "../../src/Client";
import InternalError from "../../src/Exceptions/InternalError";

jest.mock("got", () => {
    const fn = jest.fn(async (url) => {
        const fs = await import("fs/promises");

        switch (url) {
            case "https://stackoverflow.com/users/login":
                return {
                    statusCode: 200,
                    body: await fs.readFile("./tests/mocks/login_nofkey.html", {
                        encoding: "utf-8",
                    }),
                };
        }
    });

    return Object.assign(fn, { extend: () => fn });
});

describe("Login Failure", () => {
    it("Should reject with InternalError when no fkey found", async () => {
        expect.assertions(1);
        const client = new Client("stackoverflow.com");

        await expect(
            client.login("test@test.com", "P@ssw0rd")
        ).rejects.toThrowError(InternalError);
    });
});
