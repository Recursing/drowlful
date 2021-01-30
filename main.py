from typing import List, Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

app = FastAPI()

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast_json(self, message: Any):
        for connection in self.active_connections:
            await connection.send_json(message)


manager = ConnectionManager()
user_images = {}

@app.websocket("/ws/{username}")
async def websocket_endpoint(websocket: WebSocket, username: str, img: str):
    await manager.broadcast_json({
        "type": "new_user",
        "username": username,
        "img_src": img,
    })
    await manager.connect(websocket)
    user_images[username] = img
    await websocket.send_json({
        "type": "old_users",
        "users": user_images})
    try:
        while True:
            data = await websocket.receive_json()
            if "username" in data:
                assert data["username"] == username
            data["username"] = username
            await manager.broadcast_json(data)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print(f"MAN OVERBOARD MAN OVERBOARD: #{username}")
        # await manager.broadcast(f"Client #{username} left the chat")