import Browser from '../../src/Browser';
import Client from '../../src/Client';

jest.mock('got', () => {
    const fn = jest.fn(async (url) => {
        const fs = await import("fs/promises");

        switch (url) {
            case 'https://chat.stackoverflow.com/users/5':
                return {
                    body: await fs.readFile('./tests/mocks/profile.html', { encoding: "utf-8" })
                };
        }
    });

    return Object.assign(fn, { extend: () => fn });
});

describe('Profile', () => {
    it('Should scrape profile correctly.', async () => {
        expect.assertions(1);

        const client = new Client('stackoverflow.com');

        const browser = new Browser(client);

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
    });
});
