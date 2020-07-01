'use strict';

var utils = require('./../utils');

function encode(val) {
  return encodeURIComponent(val).
    replace(/%40/gi, '@').
    replace(/%3A/gi, ':').
    replace(/%24/g, '$').
    replace(/%2C/gi, ',').
    replace(/%20/g, '+').
    replace(/%5B/gi, '[').
    replace(/%5D/gi, ']');
}

/**
 * Build a URL by appending params to the end
 *
 * @param {string} url The base of the url (e.g., http://www.google.com)
 * @param {object} [params] The params to be appended
 * @returns {string} The formatted url
 */
// 把params拼接在URL上创建新的URL
module.exports = function buildURL(url, params, paramsSerializer) {
  /*eslint no-param-reassign:0*/
  if (!params) {
    return url;
  }

  // 第一步设置serializedParams的流程上有三个分支条件:
  //   如果有paramsSerializer方法则直接用来处理params参数
  //   如果params是URLSearchParams对象就直接调用toString方法
  //   否则直接调用utils.forEach,根据类型在回调函数做一层转换,最终输出一份&拼接的字符串参数
  var serializedParams;
  if (paramsSerializer) { // 使用paramsSerializer处理params
    serializedParams = paramsSerializer(params);
  } else if (utils.isURLSearchParams(params)) { // params是URLSearchParams，直接调用toString方法
    serializedParams = params.toString();
  } else {
    var parts = [];

    utils.forEach(params, function serialize(val, key) {
      if (val === null || typeof val === 'undefined') {
        return;
      }

      if (utils.isArray(val)) { // val是数组，key后面拼接[]表示数组
        key = key + '[]';
      } else { // val不是数组，将val包裹在数组中
        val = [val];
      }

      utils.forEach(val, function parseValue(v) {
        if (utils.isDate(v)) {
          v = v.toISOString();
        } else if (utils.isObject(v)) {
          v = JSON.stringify(v);
        }
        parts.push(encode(key) + '=' + encode(v));
      });
    });

    serializedParams = parts.join('&'); // 将处理过的params数组parts拼接成字符串
  }
  
  // 第二步如果上面能得到serializedParams的情况,根据url规则拼接上去
  // 如果有serializedParams，url先去掉hash再拼接serializedParams
  if (serializedParams) {
    var hashmarkIndex = url.indexOf('#');
    if (hashmarkIndex !== -1) {
      url = url.slice(0, hashmarkIndex);
    }
  
    url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;
  }

  // 第三步返回拼接后的url或者原始url
  return url;
};
