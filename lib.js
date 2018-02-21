function hashString(string, concurrency) {
	/* eslint no-bitwise: ["error", { "allow": ["<<"] }] */
	const hash = string.split('').reduce((prevHash, currVal) => ((prevHash << 5) - prevHash) + currVal.charCodeAt(0), 0);
	return Math.abs(hash) % concurrency;
}

module.exports = {
	hashString,
};
