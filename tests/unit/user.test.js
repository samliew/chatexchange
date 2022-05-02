import Client from "../../src/Client";
import User from '../../src/User';

describe('User', () => {
    it('Should create a new user', () => {
        const user = new User(null, 4);

        expect(user.id).toEqual(4);
    });

    it('Should fetch data correctly', async () => {
        expect.assertions(12);

        const getProfileMock = jest.fn(() => Promise.resolve({
            name: 'test',
            about: 'Just a test user',
            isModerator: true,
            messageCount: 8671,
            roomCount: 51,
            lastSeen: 50,
            lastMessage: 120,
            reputation: 2048,
            parentId: 42,
            parentHost: "stackoverflow.com",
            parentSite: "stackoverflow.com"
        }));

        const client = new Client("stackoverflow.com");
        client.browser = { getProfile: getProfileMock };

        const user = new User(client, 4);

        await user.scrapeProfile();

        expect(await user.name).toEqual('test');
        expect(await user.about).toEqual('Just a test user');
        expect(await user.isModerator).toEqual(true);
        expect(await user.messageCount).toEqual(8671);
        expect(await user.roomCount).toEqual(51);
        expect(await user.lastSeen).toEqual(50);
        expect(await user.lastMessage).toEqual(120);
        expect(await user.reputation).toEqual(2048);

        const parent = await user.parent;
        expect(parent.id).toEqual(42);
        expect(parent.host).toEqual("stackoverflow.com");
        expect(parent.site).toEqual("stackoverflow.com");

        expect(getProfileMock).toHaveBeenLastCalledWith(user);
    });

    it('Should not call scrapeProfile twice', async () => {
        const fieldValues = {
            name: 'test',
            about: 'Just a test user',
            isModerator: true,
            messageCount: 5,
            roomCount: 2,
            lastSeen: 50,
            lastMessage: 120,
            reputation: 2048
        };

        const getProfileMock = jest.fn(() => Promise.resolve(fieldValues));

        const client = new Client("stackoverflow.com");
        client.browser = { getProfile: getProfileMock };

        const fields = ['name', 'about', 'isModerator', 'messageCount', 'roomCount', 'lastSeen', 'lastMessage', 'reputation'];

        for (const field of fields) {
            getProfileMock.mockClear();

            const user = new User(client, 4);

            expect(await user[field]).toEqual(fieldValues[field]);
            expect(await user.name).toEqual('test');
            expect(await user.about).toEqual('Just a test user');
            expect(await user[field]).toEqual(fieldValues[field]);

            expect(getProfileMock).toHaveBeenCalledTimes(1);
            expect(getProfileMock).toHaveBeenLastCalledWith(user);
        }
    });
});
