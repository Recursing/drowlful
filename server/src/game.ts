import { User, State, Drawing } from "./interfaces";

class ServerState implements State {
  users: User[] = [];
  drawings: Drawing[] = [];
  phase: State["phase"] = "login";
  guesses = [];
  votes = [];
}

// https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle#Sattolo's_algorithm
function sattolo_shuffle(array: unknown[]) {
  for (let i = array.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * i);
    let old_j = array[j];
    array[j] = array[i];
    array[i] = old_j;
  }
  return array;
}

class Game {
  state: State;
  constructor() {
    this.state = new ServerState();
  }

  login(name: string, img_src: string, prompt: string) {
    for (let user of this.state.users) {
      if (user.username === name) {
        return `${name} name is taken, choose a different one`;
      }
      if (user.img_src === img_src) {
        return "Image is taken, choose a different one";
      }
      if (user.proposed_prompt === prompt) {
        return `${prompt} prompt is taken, choose a different one`;
      }
    }

    this.state.users.push({
      username: name,
      img_src: img_src,
      proposed_prompt: prompt,
      assigned_prompt: "",
      score: 0,
      lol_score: 0,
    });
  }

  startGame() {
    if (this.state.users.length < 4) {
      return "Not enough players! Need at least 4";
    }
    if (this.state.phase !== "login") {
      return "Cannot start game from phase: " + this.state.phase;
    }
    const prompts = this.state.users.map((u) => u.proposed_prompt);
    sattolo_shuffle(prompts);
    this.state.users.map((u, i) => (u.assigned_prompt = prompts[i]));
    if (this.state.users.some((u) => u.assigned_prompt === u.proposed_prompt)) {
      console.error("Shuffling error!!!!");
      throw Error("Shuffling error!!!!");
    }
    this.state.phase = "draw";
  }
}

export const game = new Game();
