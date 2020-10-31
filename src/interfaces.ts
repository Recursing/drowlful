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

