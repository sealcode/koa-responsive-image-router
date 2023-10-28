export type SmartCropOptions = {
	width: number;
	height: number;
};

export type DirectCropOptions = SmartCropOptions & {
	x: number;
	y: number;
};
