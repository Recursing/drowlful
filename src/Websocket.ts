import type { Drawing, Guess, Vote, State } from "./interfaces";
import { state } from "./stores";
import io from "socket.io-client";
class Socket {
  private socket: SocketIOClient.Socket;
  constructor() {
    const protocol = document.location.hostname === "localhost" ? "ws" : "wss";
    this.socket = io(`${protocol}://${document.location.hostname}:8000`);
    this.socket.on("update state", (new_state: State) => {
      console.log(new_state);
      state.set(new_state);
    });
  }

  async login(name: string, img_src: string, prompt: string) {
    this.socket.emit("login", name, img_src, prompt);
    return new Promise((resolve, reject) => {
      this.socket.on("ok", resolve);
      this.socket.on("error", reject);
    });
  }

  async startGame() {
    this.socket.emit("start game");
    return new Promise((resolve, reject) => {
      this.socket.on("ok", resolve);
      this.socket.on("error", reject);
    });
  }

  async sendDrawing(drawing: Drawing) {
    this.socket.emit("drawing", drawing);
    return new Promise((resolve, reject) => {
      this.socket.on("ok", resolve);
      this.socket.on("error", reject);
    });
  }

  async sendGuess(guess: Guess) {
    this.socket.emit("guess", guess);
    return new Promise((resolve, reject) => {
      this.socket.on("ok", resolve);
      this.socket.on("error", reject);
    });
  }

  async sendVote(vote: Vote) {
    this.socket.emit("vote", vote);
    return new Promise((resolve, reject) => {
      this.socket.on("ok", resolve);
      this.socket.on("error", reject);
    });
  }

  async sendLOL(vote: Vote) {
    this.socket.emit("lol vote", vote);
    return new Promise((resolve, reject) => {
      this.socket.on("ok", resolve);
      this.socket.on("error", reject);
    });
  }
}

export const socket = new Socket();
