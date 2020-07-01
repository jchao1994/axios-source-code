'use strict';

var utils = require('./../utils');
var transformData = require('./transformData');
var isCancel = require('../cancel/isCancel');
var defaults = require('../defaults');

/**
 * Throws a `Cancel` if cancellation has been requested.
 */
// 如果有config.cancelToken，抛出取消
function throwIfCancellationRequested(config) {
  if (config.cancelToken) {
    config.cancelToken.throwIfRequested();
  }
}

/**
 * Dispatch a request to the server using the configured adapter.
 *
 * @param {object} config The config that is to be used for the request
 * @returns {Promise} The Promise to be fulfilled
 */
// 向服务器发送请求
module.exports = function dispatchRequest(config) {
  // 如果已经取消请求则抛出错误
  throwIfCancellationRequested(config);

  // Ensure headers exist
  config.headers = config.headers || {};

  // Transform request data
  // 根据config.transformRequest中的每个fn处理data和headers，返回处理过的data
  config.data = transformData(
    config.data,
    config.headers,
    config.transformRequest
  );

  // Flatten headers
  // 将headers扁平化处理
  config.headers = utils.merge(
    config.headers.common || {},
    config.headers[config.method] || {},
    config.headers
  );
  
  // 移除config.headers.delete/get/head/post/put/patch/common
  utils.forEach(
    ['delete', 'get', 'head', 'post', 'put', 'patch', 'common'],
    function cleanHeaderConfig(method) {
      delete config.headers[method];
    }
  );

  // 根据不同环境(浏览器和nodejs)得来的promise适配器
  var adapter = config.adapter || defaults.adapter;
  
  // 调用adapter(config)返回一个带response的promise
  return adapter(config).then(function onAdapterResolution(response) {
    // 如果请求已经取消则抛出错误
    throwIfCancellationRequested(config);

    // Transform response data
    // 根据config.transformResponse中的每个fn处理response的data和headers，返回处理过的data
    response.data = transformData(
      response.data,
      response.headers,
      config.transformResponse
    );

    return response;
  }, function onAdapterRejection(reason) {
    if (!isCancel(reason)) { // 未取消
      // 如果请求已经取消则抛出错误
      throwIfCancellationRequested(config);

      // Transform response data
      // 根据config.transformResponse中的每个fn处理reason.response的data和headers，返回处理过的reason.response.data
      if (reason && reason.response) {
        reason.response.data = transformData(
          reason.response.data,
          reason.response.headers,
          config.transformResponse
        );
      }
    }

    return Promise.reject(reason);
  });
};
