// Number of chunks to split the Excel files into.
// This value must be consistent with the NUM_CHUNKS environment variable
// used in the GitHub Actions workflow (.github/workflows/build-bot.yml)
// and any other parts of the system that rely on this number.
export const NUM_CHUNKS = 8;
