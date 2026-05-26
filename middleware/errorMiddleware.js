const errorMiddleware = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error.code === "P2002") {
    return res.status(409).json({
      message: "Unique constraint failed",
      fields: error.meta?.target,
    });
  }

  if (error.code === "P2003") {
    return res.status(400).json({
      message: "Invalid related resource",
      field: error.meta?.field_name,
    });
  }

  if (error.code === "P2025") {
    return res.status(404).json({
      message: "Resource not found",
    });
  }

  const statusCode = error.statusCode || 500;

  res.status(statusCode).json({
    message: error.message || "Internal server error",
  });
};

module.exports = errorMiddleware;
