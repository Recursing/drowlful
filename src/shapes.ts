import type { Shape, Polyline, Ellipse } from "./interfaces";

const line_length = (points: [number, number][]): number => {
  if (points.length === 0) return 0;
  let t = 0;
  let [last_x, last_y] = points[0];
  for (let [cur_x, cur_y] of points) {
    t += Math.sqrt((cur_y - last_y) ** 2 + (cur_x - last_x) ** 2);
    last_x = cur_x;
    last_y = cur_y;
  }
  return t;
};
const ellipse_length = (e: Ellipse): number => {
  // overkill but for the lulz
  const a = Math.abs(e.x2 - e.x1) / 2;
  const b = Math.abs(e.y2 - e.y1) / 2;
  const t = ((a - b) / (a + b)) ** 2;
  return Math.PI * (a + b) * (1 + (3 * t) / (10 + Math.sqrt(4 - 3 * t)));
};

export const shape_length = (s: Shape): number =>
  s.type === "polyline" ? line_length(s.points) : ellipse_length(s);

const interpolated_ellipse = (s: Ellipse, l: number): Ellipse => {
  const ratio = l / ellipse_length(s);
  return {
    ...s,
    x2: s.x1 + (s.x2 - s.x1) * ratio,
    y2: s.y1 + (s.y2 - s.y1) * ratio,
  };
};

const interpolated_line = (s: Polyline, l: number): Polyline => {
  let points: [number, number][] = [];
  if (s.points.length < 2) {
    return s;
  }
  let [last_x, last_y] = s.points[0];
  for (let [cur_x, cur_y] of s.points) {
    let t = Math.sqrt((cur_y - last_y) ** 2 + (cur_x - last_x) ** 2);
    if (t <= l) {
      points.push([cur_x, cur_y]);
      l -= t;
    } else {
      let ratio = l / t;
      cur_x = last_x + (cur_x - last_x) * ratio;
      cur_y = last_y + (cur_y - last_y) * ratio;
      points.push([cur_x, cur_y]);
      break;
    }
    last_x = cur_x;
    last_y = cur_y;
  }
  return {
    ...s,
    points,
  };
};
export const interpolated_shape = (s: Shape, l: number): Shape =>
  s.type === "polyline" ? interpolated_line(s, l) : interpolated_ellipse(s, l);
