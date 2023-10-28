export type resolutionGuessOptions = {
	min_viewport_size?: number;
	max_viewport_size?: number;
};

export type Unit = "vw" | "px";

export type Ranges = {
	screen: number[][];
	calculated: number[][];
};

export type Condition = {
	condition_type: "max" | "min" | "default";
	width_condition: number;
	then_res: number;
	then_unit: "vw" | "px";
};
