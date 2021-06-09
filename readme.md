# ChatExchange

[![Build](https://github.com/samliew/chatexchange/actions/workflows/nodejs.yml/badge.svg)](https://github.com/samliew/chatexchange/actions/workflows/nodejs.yml)
[![Build Status](https://travis-ci.org/danbopes/chatexchange.svg?branch=master)](https://travis-ci.com/samliew/chatexchange)
[![Dependency Status](https://david-dm.org/danbopes/chatexchange.svg)](https://david-dm.org/danbopes/chatexchange)
[![Coverage Status](https://coveralls.io/repos/github/danbopes/chatexchange/badge.svg?branch=master)](https://coveralls.io/github/danbopes/chatexchange?branch=master)

A node.js API for talking to Stack Exchange chat (Largely based on [ChatExchange](https://github.com/Manishearth/ChatExchange) for python)

## Installation

Using npm:

```bash
$ npm i chatexchange
```

## Word of Caution

This API is still in development, and thus should be considered unstable. Be warned: API calls between versions may change drastically.

## Example

```javascript
const Client = require("chatexchange");

const main = async () => {
  const client = new Client("stackoverflow.com");

  await client.login("EMAIL", "PASSWORD");

  const me = await client.getMe();

  const room = await client.joinRoom(167908);

  room.on("message", async (msg) => {
    console.log("Got Message", msg);

    // eventType 8 (Someone has messaged me)
    if (msg.eventType === 8 && msg.targetUserId === me.id) {
      await msg.reply("Hello World!");
    }
  });

  // Connect to the room, and listen for new events
  await room.watch();
};

main();
```
