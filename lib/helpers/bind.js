'use strict';

module.exports = function bind(fn, thisArg) {
  return function wrap() {
    // 将arguments类数组转为args数组
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }
    return fn.apply(thisArg, args);
  };
};
