type resolutionGuessOptions = {
	min_resolution?: number;
	max_resolution?: number;
};

const fillGaps = (resolutions: number[]) => {
	const sorted_resolutions = resolutions.sort((a, b) => a - b);

	const smallest_res = sorted_resolutions[0],
		largest_res = sorted_resolutions[sorted_resolutions.length - 1];

	const gap_fills: number[] = [largest_res * 2];

	let cur_res = smallest_res * 2;
	while (cur_res < largest_res * 2) {
		gap_fills.push(cur_res);
		cur_res *= 2;
	}

	return gap_fills;
};

const guessResolutions = (
	sizes_attr: string,
	{ min_resolution = 320, max_resolution = 1920 }: resolutionGuessOptions = {}
): number[] => {
	const max_resolutions: number[] = [],
		min_resolutions: number[] = [],
		constant_resolutions: number[] = [],
		gap_fills: number[] = [];

	const getResFromVw = (vw: number, max_res: number) => (vw / 100) * max_res;

	const regex = /\((max|min)-width\s*:\s*(\d+)px\s*\)\s*(\d+)(vw|px)/gi;
	let match = regex.exec(sizes_attr);
	const condition_matches = [];
	while (match !== null) {
		condition_matches.push(match);
		match = regex.exec(sizes_attr);
	}
	const default_size_match = /(,?)\s*(\d+)(px|vw)\s*$/i.exec(sizes_attr);

	for (const match of condition_matches) {
		const condition_type = match[1] as "max" | "min",
			width_condition = parseInt(match[2]),
			then_res = parseInt(match[3]),
			then_unit = match[4];

		if (then_unit === "vw") {
			if (condition_type === "max")
				max_resolutions.push(getResFromVw(then_res, width_condition));
			else {
				const value_res = getResFromVw(then_res, max_resolution),
					condition_res = getResFromVw(then_res, width_condition);
				min_resolutions.push(condition_res, value_res);
			}
		} else {
			constant_resolutions.push(then_res);
		}
	}

	if (default_size_match) {
		const preceding_comma = default_size_match[1] as "," | null,
			default_size = parseInt(default_size_match[2]),
			unit = default_size_match[3];

		if (unit === "px") constant_resolutions.push(default_size);
		else if (unit === "vw") {
			if (max_resolutions.length) {
				max_resolutions.push(
					getResFromVw(default_size, max_resolution)
				);
			} else min_resolutions.push(min_resolution);

			// this will execute if there is only default value specified
			if (!preceding_comma) {
				min_resolutions.push(
					getResFromVw(default_size, max_resolution)
				);
			}
		}
	}

	// if there are any max-width conditions push min_resolution for further gap filling
	if (max_resolutions.length) {
		max_resolutions.push(min_resolution);
	}

	const min_max_resolutions = max_resolutions.concat(min_resolutions);

	const filtered_resolutions = min_max_resolutions.map((res) => {
		if (res < min_resolution) {
			return min_resolution;
		} else return Math.round(res);
	});

	const resolutions = [...filtered_resolutions, ...constant_resolutions];

	gap_fills.push(...fillGaps(resolutions));

	const final_resolutions = [
		...new Set(resolutions.concat(...gap_fills)),
	].sort((a, b) => a - b);

	return final_resolutions;
};

export { guessResolutions };
