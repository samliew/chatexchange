import ChatExchangeError from './Exceptions/ChatExchangeError';

export const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export const lazy = async (getter, updater) => {
    let result = getter();
    if (typeof result !== 'undefined') {
        return result;
    }

    await updater();

    result = getter();

    if (typeof result === 'undefined') {
        throw new ChatExchangeError('Unable to find field.');
    }

    return result;
};

/**
 * Helper function to convert an array, to key/value pairs.
 * ie. ['foo', 'bar', 'meow', 'rawr'] => {foo: 'bar', meow: 'rawr'}
 *
 * @param {Array<string|number>} array The array to convert
 * @returns {Object} The object that was converted
 */
export const arrayToKvp = array => array.reduce((arr, val, idx, ori) => {
    if (idx % 2 === 1) {
        const key = ori[idx - 1];
        arr[key] = val;
    }

    return arr;
}, {});

/* eslint-disable id-length */
const suffixes = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
    y: 31536000,
};
/* eslint-enable id-length */

export const parseAgoString = text => {
    if (text === 'n/a') {
        return -1;
    }
    
    if (text === 'just now') {
        return 0;
    }

    const [str] = text.split(' ');

    const char = str.slice(-1);

    if (typeof suffixes[char] === 'undefined') {
        throw new ChatExchangeError('Suffix Character Unrecognized'); 
    }

    const number = parseInt(str.slice(0, -1), 10);

    return number * suffixes[char];
};
