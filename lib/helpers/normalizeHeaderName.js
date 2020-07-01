'use strict';

var utils = require('../utils');

module.exports = function normalizeHeaderName(headers, normalizedName) { // 处理大小写格式化
  utils.forEach(headers, function processHeader(value, name) {
    if (name !== normalizedName && name.toUpperCase() === normalizedName.toUpperCase()) {
      headers[normalizedName] = value;
      delete headers[name];
    }
  });
};
