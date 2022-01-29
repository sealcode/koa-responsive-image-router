declare type resolutionGuessOptions = {
	min_resolution?: number;
	max_resolution?: number;
};
declare const guessResolutions: (
	sizes_attr: string,
	{ min_resolution, max_resolution }?: resolutionGuessOptions
) => number[];
export { guessResolutions };
