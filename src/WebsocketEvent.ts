import Client from "./Client";
import Message from "./Message";

/**
 * @summary chat event type options
 * @see https://meta.stackexchange.com/a/218443/786798
 */
export enum ChatEventType {
    MESSAGE_POSTED = 1,
    MESSAGE_EDITED = 2,
    USER_JOINED = 3,
    USER_LEFT = 4,
    ROOM_RENAMED = 5,
    STARS_CHANGED = 6,
    USER_MENTIONED = 8,
    MESSAGE_FLAGGED = 9,
    MESSAGE_DELETED = 10,
    FILE_ADDED = 11,
}

/**
 * @summary chat websocket event
 */
export interface ChatEvent {
    // Best guess required items
    id: ChatEventType;
    event_type: number;
    time_stamp: number;
    room_id: number;
    room_name: string;
    user_id: number;
    user_name: string;

    // Best guess optional/not always included as part of event
    content?: string;
    target_user_id?: number;
    parent_id?: number;
    message_id?: number;
}

/**
 * @summary chat websocket event response (`/chats/<roomId>/events`)
 */
export interface ChatEventsResponse {
    ms: number;
    sync: number;
    time: number;
    events: ChatEvent[];
}

export class WebsocketEvent extends Message {
    public eventType: number;
    public timeStamp: number;
    public userId: number;
    public userName: string;
    public targetUserId: number | undefined;

    /**
     * @param {Client} client main chatexchange Client class instance
     * @param {ChatEvent} websocketMsg message from the chat websocket
     */
    constructor(client: Client, websocketMsg: ChatEvent) {
        const {
            message_id,
            content,
            room_id,
            room_name,
            event_type,
            time_stamp,
            target_user_id,
            user_id,
            user_name,
        } = websocketMsg;

        super(client, message_id, {
            content,
            roomId: room_id,
            roomName: room_name,
        });

        this.eventType = event_type;
        this.timeStamp = time_stamp;
        this.targetUserId = target_user_id;
        this.userId = user_id;
        this.userName = user_name;
    }
}

export default WebsocketEvent;
