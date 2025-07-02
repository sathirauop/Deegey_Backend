const blacklistedTokens = new Set();

const addToBlacklist = (token) => {
  blacklistedTokens.add(token);

  setTimeout(
    () => {
      blacklistedTokens.delete(token);
    },
    15 * 60 * 1000
  );
};

const isBlacklisted = (token) => {
  return blacklistedTokens.has(token);
};

const clearExpiredTokens = () => {
  blacklistedTokens.clear();
};

module.exports = {
  addToBlacklist,
  isBlacklisted,
  clearExpiredTokens,
};
