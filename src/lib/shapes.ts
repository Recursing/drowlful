import type { Ellipse, Polyline, Shape } from "$lib/types";

const line_length = (points: [number, number][]): number => {
	const first = points.at(0);
	if (!first) return 0;
	let t = 0;
	let [last_x, last_y] = first;
	for (const [cur_x, cur_y] of points) {
		t += Math.sqrt((cur_y - last_y) ** 2 + (cur_x - last_x) ** 2);
		last_x = cur_x;
		last_y = cur_y;
	}
	return t;
};

const ellipse_length = (e: Ellipse): number => {
	// Ramanujan's approximation
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
	const points: [number, number][] = [];
	const first = s.points.at(0);
	if (s.points.length < 2 || !first) {
		return s;
	}
	let [last_x, last_y] = first;
	let remaining = l;
	for (const [cur_x, cur_y] of s.points) {
		const t = Math.sqrt((cur_y - last_y) ** 2 + (cur_x - last_x) ** 2);
		if (t <= remaining) {
			points.push([cur_x, cur_y]);
			remaining -= t;
		} else {
			const ratio = remaining / t;
			points.push([last_x + (cur_x - last_x) * ratio, last_y + (cur_y - last_y) * ratio]);
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
