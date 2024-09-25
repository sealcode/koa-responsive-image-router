import sharp from "sharp";

export const format_specific_options = (<const>{
	avif: (image) => image.avif({ quality: 80 }),
	jpeg: (image) => image.jpeg({ mozjpeg: true, quality: 90 }),
	webp: (image) => image.webp({ quality: 90 }),
}) as Record<string, ((image: sharp.Sharp) => sharp.Sharp) | undefined>;
