import cheerio from 'cheerio';

describe('cheerio', () => {
    it('Should find input val', () => {
        const $ = cheerio.load('<div><input type="text" name="fkey" value="test" /></div>');

        expect($('input[name="fkey"]').val()).toEqual('test');
    });

    it('Should not find input val', () => {
        const $ = cheerio.load('<div><input type="text" name="fk" value="test" /></div>');

        expect($('input[name="fkey"]').val()).toBeUndefined();
    });
})