from typing import List, Any, Dict, Tuple
import random

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

app = FastAPI()


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.usernames: List[str] = []

    async def connect(self, websocket: WebSocket, username: str):
        await websocket.accept()
        self.active_connections.append(websocket)
        self.usernames.append(username)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast_json(self, message: Any):
        if message["type"] == "start_game":
            await self.broadcast_start_game()
            return
        for connection in self.active_connections:
            await connection.send_json(message)

    async def broadcast_start_game(self):
        prompts = [(username, prompt) for username, [_img, prompt] in users.items()]
        random.shuffle(prompts)
        while any(pu == u for u, (pu, p) in zip(self.usernames, prompts)):
            random.shuffle(prompts)
        for connection, (_u, prompt) in zip(self.active_connections, prompts):
            print("Sending ", prompt, "from", _u)
            await connection.send_json(
                {"type": "start_game", "assigned_prompt": prompt}
            )


manager = ConnectionManager()
users: Dict[str, Tuple[str, str]] = {}


@app.websocket("/ws/{username}")
async def websocket_endpoint(
    websocket: WebSocket, username: str, img: str, prompt: str
):
    print(username, "connected with", prompt, img)
    await manager.broadcast_json(
        {
            "type": "new_user",
            "username": username,
            "img_src": img,
            "proposed_prompt": prompt,
        }
    )
    await manager.connect(websocket, username)
    users[username] = [img, prompt]
    await websocket.send_json({"type": "old_users", "users": users})
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
