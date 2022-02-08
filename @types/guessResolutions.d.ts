declare type resolutionGuessOptions = {
	min_viewport_size?: number;
	max_viewport_size?: number;
};
declare const guessResolutions: (
	sizes_attr: string,
	{ min_viewport_size, max_viewport_size }?: resolutionGuessOptions
) => number[];
export { guessResolutions };
