import type { Shape } from "$lib/types";

const MAX_USERNAME_LEN = 40;
const MAX_PROMPT_LEN = 1000;
const MAX_IMG_SRC_LEN = 2000;
const MAX_SHAPES = 500;
const MAX_POINTS_PER_SHAPE = 2000;
const COORD_LIMIT = 100_000;

export class ValidationError extends Error {}

function asString(v: unknown, field: string, maxLen: number): string {
	if (typeof v !== "string") throw new ValidationError(`${field} must be a string`);
	const trimmed = v.trim();
	if (trimmed.length === 0) throw new ValidationError(`${field} is required`);
	if (trimmed.length > maxLen)
		throw new ValidationError(`${field} too long (max ${maxLen} characters)`);
	return trimmed;
}

function asNumber(v: unknown, field: string, limit: number): number {
	if (typeof v !== "number" || !Number.isFinite(v))
		throw new ValidationError(`${field} must be a finite number`);
	if (v < -limit || v > limit) throw new ValidationError(`${field} out of bounds`);
	return v;
}

export function validateUsername(v: unknown): string {
	return asString(v, "username", MAX_USERNAME_LEN);
}

export function validatePrompt(v: unknown): string {
	return asString(v, "prompt", MAX_PROMPT_LEN);
}

export function validateImgSrc(v: unknown): string {
	return asString(v, "img_src", MAX_IMG_SRC_LEN);
}

function validateShape(raw: unknown, idx: number): Shape {
	if (raw === null || typeof raw !== "object")
		throw new ValidationError(`shapes[${idx}] must be an object`);
	const obj = raw as Record<string, unknown>;
	const type = obj.type;
	const stroke = obj.stroke;
	const width = obj.width;
	const fill = obj.fill;

	if (typeof stroke !== "string" || stroke.length > 64)
		throw new ValidationError(`shapes[${idx}].stroke must be a short string`);
	if (typeof width !== "number" || !Number.isFinite(width) || width < 0 || width > 1000)
		throw new ValidationError(`shapes[${idx}].width must be a number 0..1000`);
	if (typeof fill !== "boolean") throw new ValidationError(`shapes[${idx}].fill must be a boolean`);

	if (type === "polyline") {
		const points = obj.points;
		if (!Array.isArray(points)) throw new ValidationError(`shapes[${idx}].points must be an array`);
		if (points.length > MAX_POINTS_PER_SHAPE)
			throw new ValidationError(
				`shapes[${idx}].points has too many points (max ${MAX_POINTS_PER_SHAPE})`,
			);
		const cleanPoints: [number, number][] = points.map((p, j) => {
			if (!Array.isArray(p) || p.length !== 2)
				throw new ValidationError(`shapes[${idx}].points[${j}] must be [x, y]`);
			return [
				asNumber(p[0], `shapes[${idx}].points[${j}][0]`, COORD_LIMIT),
				asNumber(p[1], `shapes[${idx}].points[${j}][1]`, COORD_LIMIT),
			];
		});
		return { type: "polyline", stroke, width, fill, points: cleanPoints };
	}

	if (type === "ellipse") {
		return {
			type: "ellipse",
			stroke,
			width,
			fill,
			x1: asNumber(obj.x1, `shapes[${idx}].x1`, COORD_LIMIT),
			y1: asNumber(obj.y1, `shapes[${idx}].y1`, COORD_LIMIT),
			x2: asNumber(obj.x2, `shapes[${idx}].x2`, COORD_LIMIT),
			y2: asNumber(obj.y2, `shapes[${idx}].y2`, COORD_LIMIT),
		};
	}

	throw new ValidationError(`shapes[${idx}].type must be "polyline" or "ellipse"`);
}

export function validateShapes(v: unknown): Shape[] {
	if (!Array.isArray(v)) throw new ValidationError("shapes must be an array");
	if (v.length > MAX_SHAPES) throw new ValidationError(`too many shapes (max ${MAX_SHAPES})`);
	return v.map((s, i) => validateShape(s, i));
}
