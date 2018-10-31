import Browser from '../../src/Browser'

jest.mock('request-promise-native', function() {
    const fs = require('fs');
    const fn = jest.fn(async (options) => {
        switch (options.uri) {
            case 'https://chat.stackoverflow.com/transcript/message/5':
                return {
                    body: fs.readFileSync('./tests/mocks/transcript.html').toString('utf-8'),
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

describe('Transcript', () => {
    it('Should transcribe profile correctly.', async () => {
        expect.assertions(1);

        const browser = new Browser(null, 'stackoverflow.com');
        
        const transcript = await browser.getTranscript(5);

        expect(transcript).toEqual({ id: 5,
            content:
             '@JonClements Well, when you\'re working with JavaScript all day, it slowly destro҉ys your will to keep fighting. I\'m starting to lose it',
            roomId: 167908,
            roomName: 'SOBotics Workshop',
            edited: false,
            parentMessageId: 44430856 });
    })
})
