const generateCode = (prefix) =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0")}`;

module.exports = generateCode;
