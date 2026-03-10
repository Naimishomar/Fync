const errorLogger = (err, req, res, next) => {
    const timestamp = new Date().toISOString();

    // Log to terminal only (with colors for better visibility)
    console.error(`\x1b[31m[${timestamp}] ERROR: ${err.message}\x1b[0m`);
    if (err.stack) {
        console.error(err.stack);
    }
    console.error(`\x1b[33mPath: ${req.method} ${req.url}\x1b[0m`);

    // Send a standard error response instead of crashing
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        success: false,
        message: err.message || "Internal Server Error",
        error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
};

export default errorLogger;
