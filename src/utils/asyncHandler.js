// Wraps an async route handler so any rejected promise is forwarded to
// Express's error middleware instead of crashing the process or hanging
// the request. Saves a try/catch in every single controller function.
export function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
