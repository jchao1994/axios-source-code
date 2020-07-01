'use strict';

var utils = require('./utils');
var bind = require('./helpers/bind');
var Axios = require('./core/Axios');
var mergeConfig = require('./core/mergeConfig');
var defaults = require('./defaults');

/**
 * Create an instance of Axios
 *
 * @param {Object} defaultConfig The default config for the instance
 * @return {Axios} A new instance of Axios
 */
// 创建axios实例
function createInstance(defaultConfig) { // defaultConfig为defaults
  var context = new Axios(defaultConfig); // 根据defaults创建axios实例
  // instance(options)返回Axios.prototype.request.apply(context, options)的结果，也就是将instance绑定为Axios.prototype.request
  var instance = bind(Axios.prototype.request, context);

  // Copy axios.prototype to instance
  // 将Axios.prototype上的方法拷贝到instance上
  utils.extend(instance, Axios.prototype, context);

  // Copy context to instance
  // 将context上的属性拷贝到instance上
  utils.extend(instance, context);

  return instance;
}

// Create the default instance to be exported
// 创建instance实例
var axios = createInstance(defaults);

// Expose Axios class to allow class inheritance
// 暴露出Axios类
axios.Axios = Axios;

// Factory for creating new instances
axios.create = function create(instanceConfig) { // 将axios.defaults和instanceConfig合并作为defaultConfig创建出新的axios实例
  return createInstance(mergeConfig(axios.defaults, instanceConfig));
};

// Expose Cancel & CancelToken
// cancel示例 https://segmentfault.com/a/1190000020547720
// 外部调用cancel(msg)时会触发cancelToken实例内部的promise的resolve(msg)
// 而adapter()会对config.cancelToken.promise设置then，一旦resolve(msg)，就能实现取消处理
axios.Cancel = require('./cancel/Cancel');
axios.CancelToken = require('./cancel/CancelToken');
axios.isCancel = require('./cancel/isCancel');

// Expose all/spread
// axios.all(promises) 等价于 Promise.all(promises)
axios.all = function all(promises) {
  return Promise.all(promises);
};
axios.spread = require('./helpers/spread');

module.exports = axios;

// Allow use of default import syntax in TypeScript
module.exports.default = axios;
