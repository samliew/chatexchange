

class Message {
    constructor(room, event) {
        this.room = room;
        this.id = event.id;
        this.eventType = event.event_type;
        this.content = event.content;
        this.userId = event.user_id;
        this.targetUserId = event.target_user_id;
        this.roomId = event.roomId;
        this.roomName = event.roomName;
        this.messageId = event.message_id;
        this.userName = event.user_name;
    }

    reply(content) {
        return this.room.sendMessage(`:${this.messageId} ${content}`);
    }
}

export default Message;