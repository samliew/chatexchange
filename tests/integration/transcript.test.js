import Browser from '../../src/Browser';
import Client from '../../src/Client';
import User from '../../src/User';

jest.mock('got', () => {
    const fn = jest.fn(async (url) => {
        const fs = await import("fs/promises");

        switch (url) {
            case 'https://chat.stackoverflow.com/transcript/message/5':
                return {
                    body: await fs.readFile('./tests/mocks/transcript.html', { encoding: "utf-8" })
                };
        }
    });

    return Object.assign(fn, { extend: () => fn });
});

describe('Transcript', () => {
    it('Should transcribe profile correctly.', async () => {
        expect.assertions(2);

        const client = new Client('stackoverflow.com');

        const browser = new Browser(client, 'stackoverflow.com');

        const transcript = await browser.getTranscript(5);

        expect(transcript).toEqual({
            id: 5,
            content:
                '@JonClements Well, when you\'re working with JavaScript all day, it slowly destro҉ys your will to keep fighting. I\'m starting to lose it',
            roomId: 167908,
            roomName: 'SOBotics Workshop',
            edited: false,
            user: new User(client, 4875631),
            parentMessageId: 44430856
        });

        expect(await transcript.user.name).toEqual('FrankerZ');
    });
});
