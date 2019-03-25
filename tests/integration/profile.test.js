import Browser from '../../src/Browser'

jest.mock('request-promise-native', function() {
    const fs = require('fs');
    const fn = jest.fn(async (options) => {
        switch (options.uri) {
            case 'https://chat.stackoverflow.com/users/5':
                return {
                    body: fs.readFileSync('./tests/mocks/profile.html').toString('utf-8'),
                };
        }

        throw new Error(`The url ${options.uri} should not have been called.`);
    });

    fn.defaults = () => fn;
    fn.jar = () => ({
        getCookies: () => [{
            key: 'acct',
            value: 'sample-acct-cookie'
        }]
    });

    return fn;
});

describe('Profile', () => {
    it('Should scrape profile correctly.', async () => {
        expect.assertions(1);

        const browser = new Browser(null, 'stackoverflow.com');
        
        const profile = await browser.getProfile(5);

        expect(profile).toEqual({
            name: 'FrankerZ',
            id: 5,
            isModerator: false,
            roomCount: 44,
            reputation: 15026,
            lastSeen: 14,
            lastMessage: 2940,
            messageCount: 8671,
            about: 'You\'re awesome!'
        });
    })
})
