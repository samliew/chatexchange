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