import { createServer as createHttpsServer } from "https";
import { createServer as createHttpServer } from "http";
import * as path from "path";
import * as fs from "fs";

import { Server, Socket } from "socket.io";
import { game } from "./game";
import { Drawing, Guess, Vote } from "./interfaces";

const HTTPS = path.resolve("").includes("/var/www");
const httpServer = HTTPS
  ? createHttpsServer({
      key: fs.readFileSync("privkey.pem"),
      cert: fs.readFileSync("cert.pem"),
    })
  : createHttpServer();

const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:5000", "https://buonanno.tech"],
    methods: ["GET", "POST"],
  },
});

function saveState(fname: string) {
  fs.writeFileSync(fname, JSON.stringify(game.state));
}

let log_num = 0;
function updateState() {
  console.log(game.state);
  io.emit("update state", game.state);
  saveState(log_num + ".log.json");
  log_num = (log_num + 1) % 20;
}

io.on("connection", (socket: Socket) => {
  let username = "";
  console.log("A user connected");

  function error(msg: string) {
    console.error("ERROR:");
    console.error(msg);
    console.error(game.state);
    socket.emit("error", msg);
  }

  socket.on("login", (name, img_src, prompt) => {
    console.log(`logging in: ${name} ${img_src} ${prompt}`);
    const error = game.login(name, img_src, prompt);
    if (error) {
      socket.emit("error", error);
    } else {
      username = name;
      socket.emit("ok");
      updateState();
    }
  });

  socket.on("relogin", (name) => {
    console.log(`relogin: ${name}`);
    const error = game.relogin(name);
    if (error) {
      socket.emit("error", error);
    } else {
      username = name;
      socket.emit("ok");
      updateState();
    }
  });

  socket.on("late login", (name, img_src) => {
    console.log(`late login: ${name} ${img_src}`);
    const error = game.late_login(name, img_src);
    if (error) {
      socket.emit("error", error);
    } else {
      username = name;
      socket.emit("ok");
      updateState();
    }
  });

  socket.on("start game", () => {
    console.log("start game");
    const error = game.startGame();
    if (error) {
      socket.emit("error", error);
    } else {
      socket.emit("ok");
      updateState();
    }
  });

  socket.on("drawing", (drawing: Drawing) => {
    console.log("drawing", drawing);
    drawing.prompt = drawing.prompt
      .trim()
      .toUpperCase()
      .replace(/[.!?]$/, "");
    if (game.state.phase !== "draw") {
      error("Wrong game phase for drawing: " + game.state.phase);
      return;
    }

    if (game.state.drawings.some((d) => d.username === drawing.username)) {
      error("I already have a drawing from: " + drawing.username);
      return;
    }

    game.state.drawings.push(drawing);
    if (game.state.drawings.length === game.state.users.length) {
      game.state.phase = "guess";
      game.state.current_prompt = game.state.drawings[0].prompt;
    }
    socket.emit("ok");
    updateState();
  });

  socket.on("guess", (guess: Guess) => {
    console.log("guess", guess);
    guess.guessed_prompt = guess.guessed_prompt
      .trim()
      .toUpperCase()
      .replace(/[.!?]$/, "");
    if (game.state.phase !== "guess") {
      error("Wrong game phase for a guess: " + game.state.phase);
      return;
    }
    if (guess.real_prompt !== game.state.current_prompt) {
      error("Guessing on wrong prompt: " + guess.real_prompt);
      return;
    }

    // TODO string distance
    if (guess.guessed_prompt === guess.real_prompt) {
      socket.emit("error", "Guess is too similar to real prompt!");
      return;
    }
    if (
      game.state.guesses.some(
        (g) =>
          g.real_prompt === guess.real_prompt &&
          g.guessed_prompt === guess.guessed_prompt
      )
    ) {
      socket.emit("error", "Guess is too similar to another guess!");
      return;
    }
    if (
      game.state.guesses.some(
        (g) =>
          g.real_prompt === guess.real_prompt && g.guesser_username === username
      )
    ) {
      error("You have already guessed!");
      return;
    }

    game.state.guesses.push(guess);
    if (
      game.state.guesses.filter(
        (g) => g.real_prompt === game.state.current_prompt
      ).length ===
      game.state.users.length - 2
    ) {
      game.state.phase = "vote";
    }
    socket.emit("ok");
    updateState();
  });

  socket.on("vote", (vote: Vote) => {
    console.log("vote", vote);
    if (game.state.phase !== "vote") {
      error("Wrong game phase for voting: " + game.state.phase);
      return;
    }
    if (vote.real_prompt !== game.state.current_prompt) {
      error("Voting on wrong prompt: " + vote.real_prompt);
      return;
    }
    if (
      game.state.votes.some(
        (v) =>
          v.real_prompt === vote.real_prompt && v.voter_username === username
      )
    ) {
      error("You have already voted!");
      return;
    }
    const guess = game.state.guesses.find(
      (g) =>
        g.guessed_prompt === vote.voted_prompt &&
        g.real_prompt === vote.real_prompt
    );
    if (guess === undefined && vote.voted_prompt !== vote.real_prompt) {
      error("Voted for unknown prompt " + vote.voted_prompt);
      return;
    }
    if (guess) {
      if (guess.guesser_username === username) {
        error("Can't vote for yourself >:[");
        return;
      }
      const user = game.findUser(guess.guesser_username);
      user.score += 100;
    } else {
      const drawing = game.state.drawings.find(
        (d) =>
          d.prompt === vote.voted_prompt &&
          vote.voted_prompt === vote.real_prompt
      );
      if (drawing === undefined) {
        error("Can't find drawing with prompt " + vote.voted_prompt);
        return;
      }
      if (drawing.username === username) {
        error("Can't vote for yourself >:[");
        return;
      }
      game.findUser(drawing.username).score += 100;
      game.findUser(vote.voter_username).score += 100;
    }

    game.state.votes.push(vote);

    if (
      game.state.votes.filter(
        (v) => v.real_prompt === game.state.current_prompt
      ).length ===
      game.state.users.length - 2
    ) {
      game.state.phase = "lol vote";
      const LOL_VOTE_TIMEOUT = game.state.users.length * 3000;
      const LEADERBOARD_TIMEOUT = game.state.users.length * 2000;
      const current_drawing_index = game.state.drawings.findIndex(
        (d) => d.prompt === game.state.current_prompt
      );
      const next_drawing = game.state.drawings[current_drawing_index + 1];
      setTimeout(() => {
        game.state.phase = "leaderboard";
        updateState();
        setTimeout(() => {
          if (next_drawing === undefined) {
            game.state.phase = "end";
            saveState(new Date().toISOString());
          } else {
            game.state.phase = "guess";
            game.state.current_prompt = next_drawing.prompt;
          }
          updateState();
        }, LEADERBOARD_TIMEOUT);
      }, LOL_VOTE_TIMEOUT);
    }
    socket.emit("ok");
    updateState();
  });

  socket.on("lol vote", (vote: Vote) => {
    console.log("lol vote", vote);
    if (game.state.phase !== "lol vote") {
      error("Wrong game phase for lols: " + game.state.phase);
      return;
    }
    if (vote.real_prompt !== game.state.current_prompt) {
      error("LOL voting on wrong prompt: " + vote.real_prompt);
      return;
    }
    const guess = game.state.guesses.find(
      (g) =>
        g.guessed_prompt === vote.voted_prompt &&
        g.real_prompt === vote.real_prompt
    );
    if (guess === undefined && vote.voted_prompt !== vote.real_prompt) {
      error("Voted for unknown prompt " + vote.voted_prompt);
      return;
    }
    if (guess !== undefined) {
      if (guess.guesser_username === username) {
        error("Can't vote for yourself >:[");
        return;
      }
      game.findUser(guess.guesser_username).lol_score += 1;
    } else {
      const voted_user = game.state.users.find(
        (u) =>
          u.proposed_prompt === vote.voted_prompt &&
          vote.real_prompt === vote.voted_prompt
      );
      if (voted_user === undefined) {
        error("Can't find user for prompt " + vote.voted_prompt);
        return;
      }
      if (voted_user.username === username) {
        error("Can't vote for yourself >:[");
        return;
      }
      voted_user.lol_score += 1;
    }
    game.state.lol_votes.push(vote);
    socket.emit("ok");
    updateState();
  });

  socket.on("disconnect", function () {
    console.log(username + " disconnected!!!");
    if (game.state.phase === "login") {
      game.state.users = game.state.users.filter(
        (u) => u.username !== username
      );
    }
    // TODO add disconnected_users to game.state and allow them to relogin
    updateState();
  });

  socket.emit("update state", game.state);
});

httpServer.listen(8000, () => {
  console.log("Listening on *:8000");
});
