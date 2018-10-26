import idx from '../src';
import Client from '../src/Client';

describe('Root/Index', () => {
    it('Should return client object', () => {
        expect(idx).toEqual(Client);
    })
})