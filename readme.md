# ChatExchange

[![Build Status](https://travis-ci.org/danbopes/chatexchange.svg?branch=master)](https://travis-ci.org/danbopes/chatexchange)

A node.js API for talking to Stack Exchange chat (Largely based on [ChatExchange](https://github.com/Manishearth/ChatExchange) for python)

## Installation

Using npm:

```bash
$ npm i chatexchange
```

## Word of Caution

This API is still heavily in development, and should NOT be used in production scripts.

## Example

```javascript
const Client = require('chatexchange');

const main = async () => {
    const client = new Client('stackoverflow.com');

    await client.login('EMAIL', 'PASSWORD');

    const room = await client.joinRoom(167908);

    room.on('message', async msg => {
        console.log('Got Message', msg);

        // eventType 8 (Someone has messaged me)
        if (msg.eventType === 8 && msg.targetUserId === client.getMe().id) {
            await msg.reply('Hello World!');
        }
    });

    // Connect to the room, and listen for new events
    await room.watch();
}

main();
```