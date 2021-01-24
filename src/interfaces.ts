export type Line = {
    stroke: string,
    width: number,
    points: string,
}

export type Picture = {
    prompt: string,
    username: string,
    lines: Line[],
}

export type Guess = {
    prompt: string,
    username: string,
}

interface NewUserMessage {
    type: "new_user";
    username: string;
    img_src: string;
  }

  interface OldUsersMessage {
    type: "old_users";
    users: {[key: string]: string};
  }
  interface StartGameMessage {
    type: "start_game";
  }

  interface NewPictureMessage extends Picture {
    type: "picture";
  }

  interface GuessPrompt extends Guess {
    type: "guessed_prompt";
  }

  interface VotePrompt extends Guess {
    type: "voted_prompt";
  }

  interface GivePoint {
    type: "give_point";
    other_username: string;
  }

export type WebSocketMessage = NewUserMessage | OldUsersMessage | StartGameMessage | NewPictureMessage | GuessPrompt | VotePrompt | GivePoint;
