import { ScrapingError } from "../../src/Exceptions/ScrapingError";

describe("ChatExchange Errors", () => {
    describe("ScrapingError", () => {
        it("should have an html ", () => {
            expect.assertions(3);

            const htmlMsg = "<html></html>";
            const selectorMsg = "* .idonotexist";

            const err = new ScrapingError(
                "missing element",
                htmlMsg,
                selectorMsg
            );

            try {
                throw err;
            } catch ({ html, selector, message }) {
                expect(message).toEqual(message);
                expect(html).toEqual(htmlMsg);
                expect(selector).toEqual(selectorMsg);
            }
        });
    });
});
