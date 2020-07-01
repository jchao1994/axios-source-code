'use strict';

var utils = require('../utils');

/**
 * Config-specific merge-function which creates a new config-object
 * by merging two configuration objects together.
 *
 * @param {Object} config1
 * @param {Object} config2
 * @returns {Object} New object resulting from merging config2 to config1
 */
// 最后返回的config中的key为
//   valueFromConfig2Keys
//   mergeDeepPropertiesKeys
//   defaultToConfig2Keys
//   以上三种keys是默认的，总共包含29项
//   otherKeys是config2中除以上3种keys以外的keys
module.exports = function mergeConfig(config1, config2) {
  // eslint-disable-next-line no-param-reassign
  config2 = config2 || {};
  var config = {};

  var valueFromConfig2Keys = ['url', 'method', 'data'];
  var mergeDeepPropertiesKeys = ['headers', 'auth', 'proxy', 'params'];
  var defaultToConfig2Keys = [
    'baseURL', 'url', 'transformRequest', 'transformResponse', 'paramsSerializer',
    'timeout', 'withCredentials', 'adapter', 'responseType', 'xsrfCookieName',
    'xsrfHeaderName', 'onUploadProgress', 'onDownloadProgress',
    'maxContentLength', 'maxBodyLength', 'validateStatus', 'maxRedirects', 'httpAgent',
    'httpsAgent', 'cancelToken', 'socketPath', 'responseEncoding'
  ];

  // valueFromConfig2Keys中的3项只取config2中的
  utils.forEach(valueFromConfig2Keys, function valueFromConfig2(prop) {
    if (typeof config2[prop] !== 'undefined') {
      config[prop] = config2[prop];
    }
  });

  // mergeDeepPropertiesKeys中的4项优先取config2中的
  // 如果是对象或数组，会深度合并
  // 如果不是对象或数组，直接赋值
  utils.forEach(mergeDeepPropertiesKeys, function mergeDeepProperties(prop) {
    if (utils.isObject(config2[prop])) { // 如果config2[prop]是对象或数组，进行深度合并
      config[prop] = utils.deepMerge(config1[prop], config2[prop]);
    } else if (typeof config2[prop] !== 'undefined') { // 如果config2[prop]不是对象或数组，直接赋值
      config[prop] = config2[prop];
    // 这里开始是config2[prop]为undefined的情况，也就是优先config2
    } else if (utils.isObject(config1[prop])) { // 如果config1[prop]是对象或数组，进行深度合并
      config[prop] = utils.deepMerge(config1[prop]);
    } else if (typeof config1[prop] !== 'undefined') { // 如果config1[prop]不是对象或数组，直接赋值
      config[prop] = config1[prop];
    }
  });

  // defaultToConfig2Keys中的22项优先取config2中的，若config2中没有，才去config1中的
  // 均是直接赋值
  utils.forEach(defaultToConfig2Keys, function defaultToConfig2(prop) {
    if (typeof config2[prop] !== 'undefined') {
      config[prop] = config2[prop];
    } else if (typeof config1[prop] !== 'undefined') {
      config[prop] = config1[prop];
    }
  });

  var axiosKeys = valueFromConfig2Keys
    .concat(mergeDeepPropertiesKeys)
    .concat(defaultToConfig2Keys);

  var otherKeys = Object // config2中除axiosKeys以外的keys
    .keys(config2)
    .filter(function filterAxiosKeys(key) {
      return axiosKeys.indexOf(key) === -1;
    });

  // otherKeys中的优先取config2中的，若config2中没有，才去config1中的
  // 均是直接赋值
  utils.forEach(otherKeys, function otherKeysDefaultToConfig2(prop) {
    if (typeof config2[prop] !== 'undefined') {
      config[prop] = config2[prop];
    } else if (typeof config1[prop] !== 'undefined') {
      config[prop] = config1[prop];
    }
  });

  return config;
};
