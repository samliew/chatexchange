import ChatExchangeError from "./Exceptions/ChatExchangeError";

/**
 * @module Utils
 */

/**
 * Helper function to resolve promise after ms.
 *
 * @function
 * @param {number} ms Number of milliseconds to delay
 * @returns {Promise<void>} A promise that resovles after ms milliseconds
 */
export const delay = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Helper function to provide promises from getters/setters.
 * Used to lazily initialize values when the getter returns undefined.
 *
 * @function
 * @param {() => any} getter A function to return the value
 * @param {() => Promise<void>} updater A function that sets a value, that can be later retrieved from the getter
 * @returns {Promise<T>} A promise that returns the value that was set from the updater parameter
 */
export async function lazy<T>(
    getter: () => T | undefined,
    updater: () => Promise<void>
): Promise<T> {
    let result = getter();
    if (typeof result !== "undefined") {
        return result;
    }

    await updater();

    result = getter();

    if (typeof result === "undefined") {
        throw new ChatExchangeError("Unable to find field.");
    }

    return result;
}

/**
 * Helper function to convert an array, to key/value pairs.
 * ie. <code>['foo', 'bar', 'meow', 'rawr']</code> => <code>{foo: 'bar', meow: 'rawr'}</code>
 *
 * @function
 * @param {Array<string|number>} array The array to convert
 * @returns {object} The object that was converted
 */
export const arrayToKvp = (
    array: (string | number)[]
): { [key: string]: string } =>
    array.reduce((arr, val, idx, ori) => {
        if (idx % 2 === 1) {
            const key = ori[idx - 1];
            arr[key] = val;
        }

        return arr;
    }, {} as { [x: string]: any });

// tslint:disable:object-literal-sort-keys
const suffixes: { [x: string]: number } = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
    y: 31536000,
};
// tslint:enable:object-literal-sort-keys

/**
 * Helper function to parse time strings (Mainly on the profile pages) into seconds.<br />
 * For example: <code>2m ago</code> => <code>120</code>
 *
 * @function
 * @param {string} text The string of text to parse. ie <code>5s ago</code>
 * @throws {ChatExchangeError} If the string doesn't match the format suffix (s/m/h/d/y).
 * @returns {number} The number
 */
export const parseAgoString = (text: string): number => {
    if (text === "n/a") {
        return -1;
    }

    if (text === "just now") {
        return 0;
    }

    const [str] = text.split(" ");

    const char = str.slice(-1);

    if (typeof suffixes[char] === "undefined") {
        throw new ChatExchangeError("Suffix Character Unrecognized");
    }

    const time = parseInt(str.slice(0, -1), 10);

    return time * suffixes[char];
};
