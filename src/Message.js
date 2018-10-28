/**
 * Represents a message that was sent in a chatroom
 *
 * @class
 */
class Message {
    
    /**
     * Creates an instance of Message.
     * 
     * @param {Room} room The room object that this message originated from
     * @param {number} id The ID of the message
     * @param {Object} event The event object from the websocket
     * @constructor
     */
    constructor(room, id, event) {
        this.room = room;
        this.id = id;
        this.eventId = event.id;
        this.eventType = event.event_type;
        this.content = event.content;
        this.userId = event.user_id;
        this.targetUserId = event.target_user_id;
        this.roomId = event.roomId;
        this.roomName = event.roomName;
        this.userName = event.user_name;
    }

    /**
     * Send a reply to this message, replying to the user
     * (This will ping the user)
     *
     * @param {string} message The message to send
     * @returns {Promise<void>} A promise that resolves when the message was sent
     * @throws {InvalidArgumentError} If message > 500 character, empty, or isn't a string.
     * @memberof Message
     */
    reply(message) {
        return this.room.sendMessage(`:${this.id} ${message}`);
    }
}

export default Message;
