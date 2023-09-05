module.exports = {
	require: ["ts-node/register", "source-map-support/register"],
	recursive: true,
	timeout: "10000",
	spec: ["src/*.test.ts", "src/**/*.test.ts"],
};
