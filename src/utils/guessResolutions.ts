import { fit } from "object-fit-math";
import {
	Condition,
	Ranges,
	Unit,
	resolutionGuessOptions,
} from "../types/guessResolutions";
import { Container } from "../types/imageRouter";

const sortAscFn = (a: number, b: number) => a - b;

const fillGaps = (resolutions: number[]) => {
	const sorted_resolutions = resolutions.sort(sortAscFn);
	const gap_fills: number[] = [];

	const smallest_res = sorted_resolutions[0],
		largest_res = sorted_resolutions[sorted_resolutions.length - 1];

	if (largest_res) {
		let cur_res = smallest_res * 4;
		while (cur_res < largest_res) {
			gap_fills.push(cur_res);
			cur_res *= 2;
		}

		return gap_fills;
	} else return [];
};

const getResFromVw = (vw: number, max_res: number) => (vw / 100) * max_res;

const createRange = (
	val1: number,
	val2: number,
	{ subtract = 1 }: { subtract?: number } = {}
) => {
	if (val1 > val2) return [val2, val1 - subtract];
	else return [val1, val2 - subtract];
};

const rangesSortFn = (a: number[], b: number[]) => a[0] - b[0];

const sortRanges = (initialRanges: Ranges, constant_resolutions: number[]) => {
	const screen = initialRanges.screen.sort(rangesSortFn);
	const calculated = initialRanges.calculated.sort(rangesSortFn);
	const ranges = { screen, calculated };
	return {
		ranges,
		constant_resolutions: constant_resolutions.sort(sortAscFn),
	};
};

const getRanges = ({
	conditions,
	min_viewport_size,
	max_viewport_size,
}: {
	conditions: Condition[];
	max_viewport_size: number;
	min_viewport_size: number;
}) => {
	const constant_resolutions: number[] = [];
	let min_conditions_count = 0,
		max_conditions_count = 0;

	const ranges: Ranges = {
		calculated: [],
		screen: [],
	};
	const conditions_len = conditions.length;
	for (let i = 0; i < conditions_len; i++) {
		const condit = conditions[i];
		const prev_condit = conditions[i - 1];

		if (condit.then_unit === "px") {
			constant_resolutions.push(condit.then_res);
			if (conditions_len === 1)
				return sortRanges(ranges, constant_resolutions);
			continue;
		}
		const calculated_res = getResFromVw(
			condit.then_res,
			condit.width_condition
		);

		if (condit.condition_type === "max") {
			max_conditions_count++;

			if (prev_condit && prev_condit.condition_type !== "default") {
				const end_of_range_res = getResFromVw(
					condit.then_res,
					prev_condit.width_condition
				);

				ranges.screen.push(
					createRange(
						prev_condit.width_condition,
						condit.width_condition
					)
				);
				ranges.calculated.push(
					createRange(end_of_range_res, calculated_res)
				);
			}

			if (i === 0) {
				ranges.screen.push(
					createRange(min_viewport_size, condit.width_condition)
				);
				ranges.calculated.push(
					createRange(min_viewport_size, calculated_res)
				);
			}
		} else if (condit.condition_type === "min") {
			min_conditions_count++;

			if (prev_condit && prev_condit.condition_type !== "default") {
				const end_of_range_res = getResFromVw(
					condit.then_res,
					prev_condit.width_condition
				);

				ranges.calculated.push(
					createRange(calculated_res, end_of_range_res)
				);
				ranges.screen.push(
					createRange(
						condit.width_condition,
						prev_condit.width_condition
					)
				);
			}

			if (i === 0) {
				ranges.calculated.push(
					createRange(
						calculated_res,
						getResFromVw(condit.then_res, max_viewport_size),
						{ subtract: 0 }
					)
				);
				ranges.screen.push(
					createRange(condit.width_condition, max_viewport_size, {
						subtract: 0,
					})
				);
			}
		} else if (condit.condition_type === "default") {
			if (!min_conditions_count && !max_conditions_count) {
				ranges.screen.push(
					createRange(min_viewport_size, max_viewport_size, {
						subtract: 0,
					})
				);
				ranges.calculated.unshift(
					createRange(
						min_viewport_size,
						getResFromVw(condit.then_res, max_viewport_size),
						{ subtract: 0 }
					)
				);

				return sortRanges(ranges, constant_resolutions);
			}

			const sorted_screen_ranges = ranges.screen.sort(rangesSortFn);

			const start_range = sorted_screen_ranges[0][0];
			const end_range =
				sorted_screen_ranges[sorted_screen_ranges.length - 1][1] + 1;

			if (min_conditions_count) {
				ranges.screen.push(createRange(min_viewport_size, start_range));
				ranges.calculated.unshift(
					createRange(
						min_viewport_size,
						getResFromVw(condit.then_res, start_range)
					)
				);
			} else if (max_conditions_count) {
				ranges.screen.push(
					createRange(end_range, max_viewport_size, { subtract: 0 })
				);
				ranges.calculated.push(
					createRange(
						getResFromVw(condit.then_res, end_range),
						getResFromVw(condit.then_res, max_viewport_size),
						{ subtract: 0 }
					)
				);
			}
		}
	}

	return sortRanges(ranges, constant_resolutions);
};

const guessResolutions = (
	sizes_attr: string,
	{
		min_viewport_size = 320,
		max_viewport_size = 1920,
	}: resolutionGuessOptions = {},
	container?: Container,
	image_size?: { width: number; height: number }
): number[] => {
	const gap_fills: number[] = [],
		resolutions: number[] = [],
		constant_resolutions: number[] = [];

	const regex = /\((max|min)-width\s*:\s*(\d+)px\s*\)\s*(\d+)(vw|px)/gi;
	let match = regex.exec(sizes_attr);
	const condition_matches = [];
	while (match !== null) {
		condition_matches.push(match);
		match = regex.exec(sizes_attr);
	}
	const default_size_match = /(,?)\s*(\d+)(px|vw)\s*$/i.exec(sizes_attr);

	const conditions: Condition[] = [];

	for (const match of condition_matches) {
		const condition_type = match[1] as "max" | "min",
			width_condition = parseInt(match[2]),
			then_res = parseInt(match[3]),
			then_unit = match[4] as Unit;

		conditions.push({
			condition_type,
			width_condition,
			then_res,
			then_unit,
		});
	}

	if (default_size_match) {
		const res = parseInt(default_size_match[2]),
			unit = default_size_match[3] as Unit;

		conditions.push({
			condition_type: "default",
			width_condition: 0,
			then_res: res,
			then_unit: unit,
		});
	}

	const { ranges, constant_resolutions: constant_resolutions_unsorted } =
		getRanges({
			conditions,
			min_viewport_size,
			max_viewport_size,
		});

	for (const range of ranges.calculated) {
		resolutions.push(...range, range[0] * 2, range[1] * 2);
	}

	for (const res of constant_resolutions_unsorted) {
		constant_resolutions.push(res, res * 2);
	}

	if (container && image_size) {
		const fitted_image_size = fit(
			container,
			image_size,
			container.objectFit || "contain"
		);
		constant_resolutions.push(
			Math.min(image_size.width, fitted_image_size.width),
			Math.min(image_size.width, fitted_image_size.width) * 2
		);
	}

	const filtered_resolutions = resolutions.map((res) => {
		if (res < min_viewport_size) {
			return min_viewport_size;
		} else return Math.round(res);
	});

	gap_fills.push(...fillGaps(filtered_resolutions));

	let final_resolutions = [
		...new Set(
			filtered_resolutions.concat(...gap_fills, ...constant_resolutions)
		),
	].sort(sortAscFn);
	if (image_size) {
		const resolutions_without_upscaling = final_resolutions.filter(
			(r) => r <= image_size.width
		);
		if (resolutions_without_upscaling.length < final_resolutions.length) {
			resolutions_without_upscaling.push(image_size.width);
		}
		final_resolutions = resolutions_without_upscaling;
	}

	return Array.from(new Set(final_resolutions));
};

export { guessResolutions };
