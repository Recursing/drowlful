import type { WebSocketMessage } from "./interfaces";
export class WebSocketConnection {
    onMessage: (message: WebSocketMessage) => void;
    websocket: WebSocket | null;
    constructor() {
        this.onMessage = (_: WebSocketMessage) => { };
        this.websocket = null;
    }

    setUp(name: string, img_src: string, prompt: string) {
        const conn_string = `wss://${document.location.host}:8000/ws/${name}?prompt=${prompt}&img=${encodeURIComponent(img_src)}`;
        console.log(conn_string);
        this.websocket = new WebSocket(conn_string);
        this.websocket.onmessage = (event: MessageEvent) => {
            console.log(event);
            console.log("got data:", event.data);
            this.onMessage(JSON.parse(event.data));
        }
    }

    sendObject(object: WebSocketMessage) {
        if (this.websocket === null) {
            console.error("Can't send without websocket");
            return;
        }
        this.websocket.send(JSON.stringify(object));
    }
};