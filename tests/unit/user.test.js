import User from '../../src/User';

describe('User', () => {
    it('Should create a new user', () => {
        const user = new User(null, 4);

        expect(user.id).toEqual(4);
    });

    it('Should fetch data correctly', async () => {
        expect.assertions(8);
        const getProfileMock = jest.fn(() => Promise.resolve({
            name: 'test',
            about: 'Just a test user',
            isModerator: true,
            messageCount: 5,
            roomCount: 2,
            lastSeen: 50,
            lastMessage: 120,
        }));

        const client = {
            _browser: {
                getProfile: getProfileMock
            }
        };


        const user = new User(client, 4);

        await user.scrapeProfile();

        expect(await user.name).toEqual('test');
        expect(await user.about).toEqual('Just a test user');
        expect(await user.isModerator).toEqual(true);
        expect(await user.messageCount).toEqual(5);
        expect(await user.roomCount).toEqual(2);
        expect(await user.lastSeen).toEqual(50);
        expect(await user.lastMessage).toEqual(120);

        expect(getProfileMock).toHaveBeenLastCalledWith(4);
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
        };

        const getProfileMock = jest.fn(() => Promise.resolve(fieldValues));

        const client = {
            _browser: {
                getProfile: getProfileMock
            }
        };

        const fields = ['name', 'about', 'isModerator', 'messageCount', 'roomCount', 'lastSeen', 'lastMessage'];

        for (const field of fields) {
            getProfileMock.mockClear();

            const user = new User(client, 4);
    
            expect(await user[field]).toEqual(fieldValues[field]);
            expect(await user.name).toEqual('test');
            expect(await user.about).toEqual('Just a test user');
            expect(await user[field]).toEqual(fieldValues[field]);
    
            expect(getProfileMock).toHaveBeenCalledTimes(1);
            expect(getProfileMock).toHaveBeenLastCalledWith(4);
        }
    });
})
