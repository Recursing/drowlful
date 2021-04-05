"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const game_1 = require("./game");
const httpServer = http_1.createServer();
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: ["http://localhost:5000", "https://buonanno.tech"],
        methods: ["GET", "POST"],
    },
});
function updateState() {
    console.log(game_1.game.state);
    io.emit("update state", game_1.game.state);
}
function saveState() {
    const fs = require("fs");
    fs.writeFile(new Date().toISOString(), game_1.game.state);
}
io.on("connection", (socket) => {
    let username = "";
    console.log("A user connected");
    function error(msg) {
        console.error("ERROR:");
        console.error(msg);
        console.error(game_1.game.state);
        socket.emit("error", msg);
    }
    socket.on("login", (name, img_src, prompt) => {
        console.log(`logged in: ${name} ${img_src} ${prompt}`);
        const error = game_1.game.login(name, img_src, prompt);
        if (error) {
            socket.emit("error", error);
        }
        else {
            username = name;
            socket.emit("ok");
            updateState();
        }
    });
    socket.on("start game", () => {
        console.log("start game");
        const error = game_1.game.startGame();
        if (error) {
            socket.emit("error", error);
        }
        else {
            socket.emit("ok");
            updateState();
        }
    });
    socket.on("drawing", (drawing) => {
        console.log("drawing", drawing);
        drawing.prompt = drawing.prompt
            .trim()
            .toUpperCase()
            .replace(/[.!?]$/, "");
        if (game_1.game.state.phase !== "draw") {
            error("Wrong game phase for drawing: " + game_1.game.state.phase);
            return;
        }
        game_1.game.state.drawings.push(drawing);
        if (game_1.game.state.drawings.length === game_1.game.state.users.length) {
            game_1.game.state.phase = "guess";
            game_1.game.state.current_prompt = game_1.game.state.drawings[0].prompt;
        }
        socket.emit("ok");
        updateState();
    });
    socket.on("guess", (guess) => {
        console.log("guess", guess);
        guess.guessed_prompt = guess.guessed_prompt
            .trim()
            .toUpperCase()
            .replace(/[.!?]$/, "");
        if (game_1.game.state.phase !== "guess") {
            error("Wrong game phase for a guess: " + game_1.game.state.phase);
            return;
        }
        if (guess.real_prompt !== game_1.game.state.current_prompt) {
            error("Guessing on wrong prompt: " + guess.real_prompt);
            return;
        }
        // TODO string distance
        if (guess.guessed_prompt === guess.real_prompt) {
            socket.emit("error", "Guess is too similar to real prompt!");
            return;
        }
        if (game_1.game.state.guesses.some((g) => g.real_prompt === guess.real_prompt &&
            g.guessed_prompt === guess.guessed_prompt)) {
            socket.emit("error", "Guess is too similar to another guess!");
            return;
        }
        if (game_1.game.state.guesses.some((g) => g.real_prompt === guess.real_prompt && g.guesser_username === username)) {
            error("You have already guessed!");
            return;
        }
        game_1.game.state.guesses.push(guess);
        if (game_1.game.state.guesses.filter((g) => g.real_prompt === game_1.game.state.current_prompt).length ===
            game_1.game.state.users.length - 2) {
            game_1.game.state.phase = "vote";
        }
        socket.emit("ok");
        updateState();
    });
    socket.on("vote", (vote) => {
        console.log("vote", vote);
        if (game_1.game.state.phase !== "vote") {
            error("Wrong game phase for voting: " + game_1.game.state.phase);
            return;
        }
        if (vote.real_prompt !== game_1.game.state.current_prompt) {
            error("Voting on wrong prompt: " + vote.real_prompt);
            return;
        }
        if (game_1.game.state.votes.some((v) => v.real_prompt === vote.real_prompt && v.voter_username === username)) {
            error("You have already voted!");
            return;
        }
        const guess = game_1.game.state.guesses.find((g) => g.guessed_prompt === vote.voted_prompt);
        if (guess === undefined && vote.voted_prompt !== vote.real_prompt) {
            error("Voted for unknown prompt " + vote.voted_prompt);
            return;
        }
        if (guess) {
            if (guess.guesser_username === username) {
                error("Can't vote for yourself >:[");
                return;
            }
            const user = game_1.game.findUser(guess.guesser_username);
            user.score += 100;
        }
        else {
            const drawing = game_1.game.state.drawings.find((d) => d.prompt === vote.voted_prompt);
            if (drawing === undefined) {
                error("Can't find drawing with prompt " + vote.voted_prompt);
                return;
            }
            if (drawing.username === username) {
                error("Can't vote for yourself >:[");
                return;
            }
            game_1.game.findUser(drawing.username).score += 100;
            game_1.game.findUser(vote.voter_username).score += 100;
        }
        game_1.game.state.votes.push(vote);
        if (game_1.game.state.votes.filter((v) => v.real_prompt === game_1.game.state.current_prompt).length ===
            game_1.game.state.users.length - 2) {
            game_1.game.state.phase = "lol vote";
            const LOL_VOTE_TIMEOUT = game_1.game.state.users.length * 3000;
            const LEADERBOARD_TIMEOUT = game_1.game.state.users.length * 2000;
            const current_drawing_index = game_1.game.state.drawings.findIndex((d) => d.prompt === game_1.game.state.current_prompt);
            const next_drawing = game_1.game.state.drawings[current_drawing_index + 1];
            setTimeout(() => {
                game_1.game.state.phase = "leaderboard";
                updateState();
                setTimeout(() => {
                    if (next_drawing === undefined) {
                        game_1.game.state.phase = "end";
                        saveState();
                    }
                    else {
                        game_1.game.state.phase = "guess";
                        game_1.game.state.current_prompt = next_drawing.prompt;
                    }
                    updateState();
                }, LEADERBOARD_TIMEOUT);
            }, LOL_VOTE_TIMEOUT);
        }
        socket.emit("ok");
        updateState();
    });
    socket.on("lol vote", (vote) => {
        console.log("lol vote", vote);
        if (game_1.game.state.phase !== "lol vote") {
            error("Wrong game phase for lols: " + game_1.game.state.phase);
            return;
        }
        if (vote.real_prompt !== game_1.game.state.current_prompt) {
            error("LOL voting on wrong prompt: " + vote.real_prompt);
            return;
        }
        const guess = game_1.game.state.guesses.find((g) => g.guessed_prompt === vote.voted_prompt);
        if (guess === undefined && vote.voted_prompt !== vote.real_prompt) {
            error("Voted for unknown prompt " + vote.voted_prompt);
            return;
        }
        if (guess !== undefined) {
            if (guess.guesser_username === username) {
                error("Can't vote for yourself >:[");
                return;
            }
            game_1.game.findUser(guess.guesser_username).lol_score += 1;
        }
        else {
            const voted_user = game_1.game.state.users.find((u) => u.proposed_prompt === vote.voted_prompt);
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
        game_1.game.state.lol_votes.push(vote);
        socket.emit("ok");
        updateState();
    });
    socket.on("disconnect", function () {
        console.log(username + " disconnected!!!");
        game_1.game.state.users = game_1.game.state.users.filter((u) => u.username !== username);
        // TODO add disconnected_users to game.state and allow them to relogin
        updateState();
    });
});
httpServer.listen(8000, () => {
    console.log("Listening on *:8000");
});
//# sourceMappingURL=index.js.map