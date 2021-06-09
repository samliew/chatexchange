import * as cheerio from "cheerio";
import { Cookie } from "tough-cookie";
import Browser from '../../src/Browser';
import Client from "../../src/Client";

describe('Browser', () => {

    describe('authentication', () => {

        it("should override 'stackexchange.com' host to 'meta.stackexchange.com'", async () => {

            const _get$mock = jest.fn(() => Promise.resolve(cheerio.load("<input name='fkey' value='test'/>")));

            class MockInternals extends Browser {
                _get$ = _get$mock;
                _getCookie(str) {
                    return new Cookie();
                }
                _post() {
                    return Promise.resolve();
                }
            }

            const host = "stackexchange.com";
            const replacement = "meta.stackexchange.com";

            const mocked = new MockInternals(new Client(host), host);

            mocked.login("ex@ample.org", "a!z5R_+@/|g-[%");

            expect(_get$mock).toHaveBeenCalledWith(`https://${replacement}/users/login`);
        });

    });
});
