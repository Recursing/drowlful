import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { game } from "./game";
import { Drawing } from "./interfaces";

const httpServer = createServer();

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5000",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket: Socket) => {
  let username = "";
  console.log("A user connected");
  socket.on("login", (name, img_src, prompt) => {
    console.log(`logged in: ${name} ${img_src} ${prompt}`);
    const error = game.login(name, img_src, prompt);
    if (error) {
      socket.emit("error", error);
    } else {
      socket.emit("ok");
      username = name;
      io.emit("update state", game.state);
    }
  });

  socket.on("start game", () => {
    const error = game.startGame();
    if (error) {
      socket.emit("error", error);
    } else {
      socket.emit("ok");
      io.emit("update state", game.state);
    }
  });

  socket.on("drawing", (drawing: Drawing) => {
    if (game.state.phase !== "draw") {
      socket.emit("error", "Wrong game phase for drawing: " + game.state.phase);
      return;
    }
    socket.emit("ok");
    game.state.drawings.push(drawing);
    if (game.state.drawings.length === game.state.users.length) {
      game.state.phase = "guess";
    }
    io.emit("update state", game.state);
  });

  socket.on("disconnect", function () {
    console.log(username + " disconnected!");
    game.state.users = game.state.users.filter((u) => u.username !== username);
    // TODO remove images and stuff
    io.emit("update state", game.state);
  });
});

httpServer.listen(8000, () => {
  console.log("Listening on *:8000");
});
