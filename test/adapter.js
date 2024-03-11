const NotNow = require("../NotNow");

exports.resolved = (value) => NotNow.resolve(value);

exports.rejected = (error) => NotNow.reject(error);

exports.deferred = () => {
  let resolveNotNow, rejectNotNow;
  let notNow = new NotNow((resolve, reject) => {
    resolveNotNow = resolve;
    rejectNotNow = reject;
  });
  return {
    promise: notNow,
    resolve: resolveNotNow,
    reject: rejectNotNow,
  };
};
