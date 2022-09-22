# ChatExchange

[![Build](https://github.com/samliew/chatexchange/actions/workflows/nodejs.yml/badge.svg)](https://github.com/samliew/chatexchange/actions/workflows/nodejs.yml)
[![Build Status](https://travis-ci.org/samliew/chatexchange.svg?branch=master)](https://travis-ci.com/samliew/chatexchange)
[![Coverage Status](https://coveralls.io/repos/github/samliew/chatexchange/badge.svg?branch=master)](https://coveralls.io/github/samliew/chatexchange?branch=master)

A Node.js API for talking to Stack Exchange chat (Largely based on [ChatExchange](https://github.com/Manishearth/ChatExchange) for python)

## Installation

Using NPM:

```bash
$ npm i chatexchange
```

## Example

```typescript
const Client = require("chatexchange");

const { ChatEventType } = require("chatexchange");

const main = async () => {
  const client = new Client("stackoverflow.com");

  await client.login("EMAIL", "PASSWORD");

  const me = await client.getMe();

  const myProfile = await client.getProfile(me);

  const { roomCount } = myProfile;
  console.log(`Rooms I am in: ${roomCount}`);

  const room = client.getRoom(167908);

  room.ignore(ChatEventType.FILE_ADDED);

  const joined = await client.joinRoom(room);
  if(joined) {
    room.on("message", async (msg) => {
        console.log("Got Message", msg);

        const { eventType, targetUserId } = msg;

        if (eventType === ChatEventType.USER_MENTIONED && targetUserId === me.id) {
            await msg.reply("Hello World!");
        }

        if(eventType === ChatEventType.USER_LEFT) {
            await msg.send("See you around!", room);
        }
    });

    // Leave the room after five minutes
    setTimeout(async () => {
        await room.sendMessage("Bye everyone!");
        await client.leaveRoom(room);
    }, 3e5);

    // Connect to the room, and listen for new events
    await room.watch();
    return;
  }

  await client.logout();
};

main();
```

## Implementations

Featured projects using ChatExchange:

- [se-electionbot](https://github.com/samliew/se-electionbot)
