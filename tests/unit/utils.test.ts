import ChatExchangeError from "../../src/Exceptions/ChatExchangeError";
import { arrayToKvp, delay, lazy, parseAgoString } from "../../src/utils";

describe("Utilities", () => {
    describe("Lazy", () => {
        test("Should throw and error when setter fails to set", async () => {
            expect.assertions(1);

            const getter = jest.fn(() => ({}));

            const setter = jest.fn(() => Promise.resolve());

            try {
                await lazy(getter, setter);
                fail();
            } catch (e) {
                expect(e).toBeInstanceOf(ChatExchangeError);
            }
        });

        test("Should return the object if it's already set", async () => {
            expect.assertions(1);

            const getter = jest.fn(() => "test");

            const result = await lazy(getter, () => Promise.resolve());

            expect(result).toStrictEqual("test");
        });

        test("Should return the object set by the setter", async () => {
            expect.assertions(3);

            const getter = jest
                .fn()
                .mockImplementationOnce(() => {})
                .mockImplementationOnce(() => "test");

            const setter = jest.fn(() => Promise.resolve());

            const result = await lazy(getter, setter);

            expect(result).toStrictEqual("test");
            expect(getter).toBeCalledTimes(2);
            expect(setter).toBeCalledTimes(1);
        });
    });

    describe("Delay", () => {
        test("Should delay for at least 40ms", async () => {
            expect.assertions(1);

            const start = new Date().getTime();

            await delay(50);

            const end = new Date().getTime();

            expect(end - start).toBeGreaterThan(40);
        });
    });

    describe("Parse Ago String", () => {
        test("Should parse things correctly", () => {
            expect.assertions(4);

            expect(parseAgoString("2d")).toStrictEqual(60 * 60 * 24 * 2);
            expect(parseAgoString("5s")).toStrictEqual(5);
            expect(parseAgoString("n/a")).toStrictEqual(-1);
            expect(parseAgoString("just now")).toStrictEqual(0);
        });

        test("Should throw an error if invalid parse string", () => {
            expect.assertions(1);

            expect(() => parseAgoString("5e")).toThrowError(ChatExchangeError);
        });
    });

    describe("ArrayToKvp", () => {
        test("Should convert successfully", () => {
            expect(arrayToKvp(["foo", "bar", "meow", "rawr"])).toEqual({
                foo: "bar",
                meow: "rawr",
            });
        });
    });
});
