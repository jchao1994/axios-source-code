'use strict';

var utils = require('./utils');
var normalizeHeaderName = require('./helpers/normalizeHeaderName');

var DEFAULT_CONTENT_TYPE = {
  'Content-Type': 'application/x-www-form-urlencoded'
};

function setContentTypeIfUnset(headers, value) {
  if (!utils.isUndefined(headers) && utils.isUndefined(headers['Content-Type'])) {
    headers['Content-Type'] = value;
  }
}

// 通过浏览器的XMLHttpRequest和nodejs中的process来区别当前在前端还是nodejs中
function getDefaultAdapter() {
  var adapter;
  if (typeof XMLHttpRequest !== 'undefined') { // XMLHttpRequest  浏览器
    // For browsers use XHR adapter
    adapter = require('./adapters/xhr');
  } else if (typeof process !== 'undefined' && Object.prototype.toString.call(process) === '[object process]') { // process  nodejs
    // For node use HTTP adapter
    adapter = require('./adapters/http');
  }
  return adapter;
}

var defaults = {
  // 根据环境优先级顺序 require('./adapters/xhr')  require('./adapters/http')  undefined
  // 支持浏览器和nodejs
  // adapter适配器 adapter()发送request请求并得到包含response的promise
  adapter: getDefaultAdapter(), 

  transformRequest: [function transformRequest(data, headers) { // 处理headers和data，返回处理过的data
    normalizeHeaderName(headers, 'Accept'); // 处理大小写格式化，将headers中的accept等转换为Accept
    normalizeHeaderName(headers, 'Content-Type'); // 处理大小写格式化，将headers中的content-type等转换为Content-Type
    if (utils.isFormData(data) ||
      utils.isArrayBuffer(data) ||
      utils.isBuffer(data) ||
      utils.isStream(data) ||
      utils.isFile(data) ||
      utils.isBlob(data)
    ) {
      return data;
    }
    if (utils.isArrayBufferView(data)) { // data是ArrayBuffer视图，那么data.buffer就是ArrayBuffer
      return data.buffer;
    }
    if (utils.isURLSearchParams(data)) { // data是URLSearchParams实例，设置headers['Content-Type']为application/x-www-form-urlencoded;charset=utf-8
      setContentTypeIfUnset(headers, 'application/x-www-form-urlencoded;charset=utf-8');
      return data.toString();
    }
    if (utils.isObject(data)) { // data是对象或数组，设置headers['Content-Type']为application/json;charset=utf-8
      setContentTypeIfUnset(headers, 'application/json;charset=utf-8');
      return JSON.stringify(data);
    }
    return data;
  }],

  transformResponse: [function transformResponse(data) { // 处理data，如果data是字符串，通过JSON.parse(data)处理data
    /*eslint no-param-reassign:0*/
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) { /* Ignore */ }
    }
    return data;
  }],

  /**
   * A timeout in milliseconds to abort a request. If set to 0 (default) a
   * timeout is not created.
   */
  timeout: 0,

  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',

  maxContentLength: -1,
  maxBodyLength: -1,

  validateStatus: function validateStatus(status) { // [200, 300)返回true，否则false
    return status >= 200 && status < 300;
  }
};

defaults.headers = {
  common: {
    'Accept': 'application/json, text/plain, */*'
  }
};

utils.forEach(['delete', 'get', 'head'], function forEachMethodNoData(method) {
  defaults.headers[method] = {};
});

utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
  defaults.headers[method] = utils.merge(DEFAULT_CONTENT_TYPE); // { 'Content-Type': 'application/x-www-form-urlencoded' }
});

module.exports = defaults;
