module.exports = {
	require: ["source-map-support/register"],
	recursive: true,
	timeout: "10000",
	spec: ["lib/*.test.js", "lib/**/*.test.js"],
};
