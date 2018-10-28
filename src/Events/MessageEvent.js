import Message from './Message';


class MessageEvent {

    /**
     * Creates an instance of MessageEvent.
     * 
     * @param {Object} event The event object that was sent from the server
     * @memberof MessageEvent
     */
    constructor(event) {
        this.id = event.id;

        this.message = new Message(event);
    }


}

export default MessageEvent;
