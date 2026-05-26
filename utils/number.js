const toInt = (value, fieldName) => {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed)) {
    const error = new Error(`${fieldName} must be an integer`);
    error.statusCode = 400;
    throw error;
  }

  return parsed;
};

const toPositiveInt = (value, fieldName) => {
  const parsed = toInt(value, fieldName);

  if (parsed <= 0) {
    const error = new Error(`${fieldName} must be greater than 0`);
    error.statusCode = 400;
    throw error;
  }

  return parsed;
};

const toNumber = (value, defaultValue = 0) => {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    const error = new Error("Value must be a number");
    error.statusCode = 400;
    throw error;
  }

  return parsed;
};

const toMoney = (value) => Number(value || 0).toFixed(2);

module.exports = {
  toInt,
  toPositiveInt,
  toNumber,
  toMoney,
};
