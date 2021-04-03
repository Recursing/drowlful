"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const game_1 = require("./game");
const httpServer = http_1.createServer();
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: "http://localhost:5000",
        methods: ["GET", "POST"],
    },
});
io.on("connection", (socket) => {
    let username = "";
    console.log("A user connected");
    socket.on("login", (name, img_src, prompt) => {
        console.log(`logged in: ${name} ${img_src} ${prompt}`);
        const error = game_1.game.login(name, img_src, prompt);
        if (error) {
            socket.emit("error", error);
        }
        else {
            socket.emit("ok");
            username = name;
            io.emit("update state", game_1.game.state);
        }
    });
    socket.on("start game", () => {
        const error = game_1.game.startGame();
        if (error) {
            socket.emit("error", error);
        }
        else {
            socket.emit("ok");
            io.emit("update state", game_1.game.state);
        }
    });
    socket.on("drawing", (drawing) => {
        if (game_1.game.state.phase !== "draw") {
            socket.emit("error", "Wrong game phase for drawing: " + game_1.game.state.phase);
            return;
        }
        socket.emit("ok");
        game_1.game.state.drawings.push(drawing);
        if (game_1.game.state.drawings.length === game_1.game.state.users.length) {
            game_1.game.state.phase = "guess";
        }
        io.emit("update state", game_1.game.state);
    });
    socket.on("disconnect", function () {
        console.log(username + " disconnected!");
        game_1.game.state.users = game_1.game.state.users.filter((u) => u.username !== username);
        // TODO remove images and stuff
        io.emit("update state", game_1.game.state);
    });
});
httpServer.listen(8000, () => {
    console.log("Listening on *:8000");
});
//# sourceMappingURL=index.js.map