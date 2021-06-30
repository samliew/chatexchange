import Client from "./Client";
import Message from "./Message";

export interface WebsocketEventAttributes {
    // Best guess required items
    id: number;
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

class WebsocketEvent extends Message {
    public eventType: number;
    public timeStamp: number;
    public userId: number;
    public userName: string;
    public targetUserId: number | undefined;

    constructor(
        client: Client,
        websocketMsg: WebsocketEventAttributes
    ) {
        super(client, websocketMsg.message_id, {
            content: websocketMsg.content,
            roomId: websocketMsg.room_id,
            roomName: websocketMsg.room_name
        });
        this.eventType = websocketMsg.event_type;
        this.timeStamp = websocketMsg.time_stamp;
        this.targetUserId = websocketMsg.target_user_id;
        this.userId = websocketMsg.user_id;
        this.userName = websocketMsg.user_name;
    }
}

export default WebsocketEvent;
