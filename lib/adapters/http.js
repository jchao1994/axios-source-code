'use strict';

var utils = require('./../utils');
var settle = require('./../core/settle');
var buildFullPath = require('../core/buildFullPath');
var buildURL = require('./../helpers/buildURL');
// http请求库
var http = require('http');
// https请求库
var https = require('https');
// follow-redirects库，替代nodejs的http和https模块，自动跟随重定向
var httpFollow = require('follow-redirects').http;
var httpsFollow = require('follow-redirects').https;
// url库，解析和格式化url
var url = require('url');
// zlib库，简单,同步压缩或解压node.js buffers
var zlib = require('zlib');
// package.json
var pkg = require('./../../package.json');
var createError = require('../core/createError');
var enhanceError = require('../core/enhanceError');

var isHttps = /https:?/;

/*eslint consistent-return:0*/
module.exports = function httpAdapter(config) {
  return new Promise(function dispatchHttpRequest(resolvePromise, rejectPromise) {
    var resolve = function resolve(value) {
      resolvePromise(value);
    };
    var reject = function reject(value) {
      rejectPromise(value);
    };
    var data = config.data;
    var headers = config.headers;

    // Set User-Agent (required by some servers)
    // Only set header if it hasn't been set in config
    // See https://github.com/axios/axios/issues/69
    // 如果headers未设置User-Agent或user-agent，就设置为默认值'axios/' + pkg.version
    if (!headers['User-Agent'] && !headers['user-agent']) {
      headers['User-Agent'] = 'axios/' + pkg.version;
    }

    // 如果data不是流stream，将data转换为Buffer类型
    // 如果data不是string ArrayBuffer Buffer Stream，返回失败的promise并中断
    if (data && !utils.isStream(data)) {
      if (Buffer.isBuffer(data)) {
        // Nothing to do...
      } else if (utils.isArrayBuffer(data)) {
        data = Buffer.from(new Uint8Array(data));
      } else if (utils.isString(data)) {
        data = Buffer.from(data, 'utf-8');
      } else {
        return reject(createError(
          'Data after transformation must be a string, an ArrayBuffer, a Buffer, or a Stream',
          config
        ));
      }

      // Add Content-Length header if data exists
      // 设置headers['Content-Length']
      headers['Content-Length'] = data.length;
    }

    // HTTP basic authentication
    // 如果配置含有auth,则拼接用户名和密码,可以为空
    var auth = undefined;
    if (config.auth) { // 如果有auth，拼接username和password
      var username = config.auth.username || '';
      var password = config.auth.password || '';
      auth = username + ':' + password;
    }

    // Parse url
    // 拼装完整的请求地址和获得请求协议
    var fullPath = buildFullPath(config.baseURL, config.url); // 获取完整URL
    var parsed = url.parse(fullPath);
    var protocol = parsed.protocol || 'http:'; // 请求协议  默认为http

    // 有种情况验证信息不包含在配置而在请求地址上需要做兼容处理
    if (!auth && parsed.auth) { // config没有auth，parsed有auth，拼接parsed中的urlUsername和urlPassword
      var urlAuth = parsed.auth.split(':');
      var urlUsername = urlAuth[0] || '';
      var urlPassword = urlAuth[1] || '';
      auth = urlUsername + ':' + urlPassword;
    }

    // 如果有auth信息的情况下要删除Authorization头,即"用户名+冒号+密码"用BASE64算法加密后的字符串
    // 常规验证流程
    //   HTTP Authorization请求标头包含用于向服务器认证用户代理的凭证，通常在服务器响应401 Unauthorized状态和WWW-Authenticate标题后。
    //   当服务器收到请求的时候,当设置了需要验证信息,如果请求头带有Authorization,会检查里面的内容是否在用户列表中
    //   如果请求头带有Authorization,会检查里面的内容是否在用户列表中
    //     有并且验证通过则返回正常响应
    //     否则返回401状态码,浏览器会弹出对话框让用户输入账号密码
    if (auth) {
      delete headers.Authorization;
    }

    // 如果是https协议下获取配置的httpsAgent信息,否则拿httpAgent信息
    var isHttpsRequest = isHttps.test(protocol); // /https:?/  协议是否为https
    var agent = isHttpsRequest ? config.httpsAgent : config.httpAgent;

    // 将所有信息放入options中
    var options = {
      path: buildURL(parsed.path, config.params, config.paramsSerializer).replace(/^\?/, ''), // 把config.params拼接在parsed.path上创建新的path
      method: config.method.toUpperCase(),
      headers: headers,
      agent: agent,
      agents: { http: config.httpAgent, https: config.httpsAgent },
      auth: auth
    };

    // 设置socket路径或者hostname和port
    if (config.socketPath) {
      options.socketPath = config.socketPath;
    } else {
      options.hostname = parsed.hostname;
      options.port = parsed.port;
    }

    // 定义代理服务器
    // proxy: {
    //   host: '127.0.0.1',
    //   port: 9000,
    //   auth: {
    //       username: 'mikeymike',
    //       password: 'rapunz3l'
    //   }
    // },
    var proxy = config.proxy;
    // 如果没有传递代理参数的话会默认配置
    if (!proxy && proxy !== false) {
      // 协议名后拼接字符串_proxy，代表代理的环境变量名
      var proxyEnv = protocol.slice(0, -1) + '_proxy';
      // 代理地址
      var proxyUrl = process.env[proxyEnv] || process.env[proxyEnv.toUpperCase()];
      if (proxyUrl) {
        // 解析代理地址
        var parsedProxyUrl = url.parse(proxyUrl);
        // no_proxy环境变量
        var noProxyEnv = process.env.no_proxy || process.env.NO_PROXY;
        // 是否应该代理shouldProxy标识
        var shouldProxy = true;

        // 根据noProxyEnv判断是否应该代理shouldProxy
        if (noProxyEnv) {
          // 返回分割并且清除空格后的数组
          var noProxy = noProxyEnv.split(',').map(function trim(s) {
            return s.trim();
          });

          // 是否应该代理
          shouldProxy = !noProxy.some(function proxyMatch(proxyElement) {
            // 不存在返回false
            if (!proxyElement) {
              return false;
            }
            // 通配符返回true
            if (proxyElement === '*') {
              return true;
            }
            // 若proxyElement以.开头，判断proxyElement与请求url的域名是否相等
            if (proxyElement[0] === '.' &&
                parsed.hostname.substr(parsed.hostname.length - proxyElement.length) === proxyElement) {
              return true;
            }

            // 判断proxyElement与parsed.hostname是否相等
            return parsed.hostname === proxyElement;
          });
        }

        // shouldProxy为true，拼装代理配置
        if (shouldProxy) {
          proxy = {
            host: parsedProxyUrl.hostname, // 域名(IP)
            port: parsedProxyUrl.port // 端口号
          };

          if (parsedProxyUrl.auth) {
            var proxyUrlAuth = parsedProxyUrl.auth.split(':');
            proxy.auth = { // 用户代理凭证
              username: proxyUrlAuth[0],
              password: proxyUrlAuth[1]
            };
          }
        }
      }
    }

    // 如果有代理配置，添加到options
    if (proxy) {
      options.hostname = proxy.host; // 代理IP
      options.host = proxy.host; // 代理IP
      options.headers.host = parsed.hostname + (parsed.port ? ':' + parsed.port : ''); // 原来的IP:端口号
      options.port = proxy.port; // 代理端口号
      options.path = protocol + '//' + parsed.hostname + (parsed.port ? ':' + parsed.port : '') + options.path; // 原来的 协议 IP 端口号 path

      // Basic proxy authorization
      // 将proxy.auth用户代理凭证编码后设置在options.headers['Proxy-Authorization']上
      if (proxy.auth) {
        var base64 = Buffer.from(proxy.auth.username + ':' + proxy.auth.password, 'utf8').toString('base64');
        options.headers['Proxy-Authorization'] = 'Basic ' + base64;
      }
    }

    // 根据协议决定使用对应的请求库,并且设定最大重定向次数和请求内容长度
    var transport;
    // 是否https代理
    var isHttpsProxy = isHttpsRequest && (proxy ? isHttps.test(proxy.protocol) : true);
    if (config.transport) {
      // 如果配置了直接使用
      transport = config.transport;
    } else if (config.maxRedirects === 0) {
      // 最大重定向次数为0(即不允许重定向)判断使用https模块还是http模块
      transport = isHttpsProxy ? https : http;
    } else {
      // 如果允许重定向
      if (config.maxRedirects) {
        options.maxRedirects = config.maxRedirects;
      }
      // 直接判断使用https重定向模块还是http重定向模块
      transport = isHttpsProxy ? httpsFollow : httpFollow;
    }

    // 如果设置了长度并且大于-1则添加到options上
    if (config.maxBodyLength > -1) {
      options.maxBodyLength = config.maxBodyLength;
    }

    // Create the request
    // 创建request
    var req = transport.request(options, function handleResponse(res) {
      // 如果终止则中断流程
      if (req.aborted) return;

      // uncompress the response body transparently if required
      var stream = res;

      // return the last request in case of redirects
      var lastRequest = res.req || req;


      // if no content, is HEAD request or decompress disabled we should not decompress
      // 解压缩，支持gzip compress deflate
      // statusCode为204 或 lastRequest.method为HEAD 或 config.decompress为false，不进行解压缩

      // 1.如果带有压缩指示的content-encoding,根据状态码是否204决定需不需要进行压缩,然后删除头避免混淆后续操作
      // HTTP协议中 204 No Content 成功状态响应码表示目前请求成功，但客户端不需要更新其现有页面
      if (res.statusCode !== 204 && lastRequest.method !== 'HEAD' && config.decompress !== false) {
        switch (res.headers['content-encoding']) {
        /*eslint default-case:0*/
        case 'gzip':
        case 'compress':
        case 'deflate':
        // add the unzipper to the body stream processing pipeline
          stream = stream.pipe(zlib.createUnzip());

          // remove the content-encoding in order to not confuse downstream operations
          // 移除res.headers['content-encoding']解压缩方式
          delete res.headers['content-encoding'];
          break;
        }
      }

      // 2.拼装response对象
      var response = {
        status: res.statusCode,
        statusText: res.statusMessage,
        headers: res.headers,
        config: config,
        request: lastRequest
      };

      // 3.根据responseType决定怎么解析响应数据,然后更新response:
      //   a)stream则直接赋值
      //   b)否则利用stream事件解析
      if (config.responseType === 'stream') {
        response.data = stream;
        settle(resolve, reject, response);
      } else {
        var responseBuffer = [];
        stream.on('data', function handleStreamData(chunk) {
          responseBuffer.push(chunk);

          // make sure the content length is not over the maxContentLength if specified
          if (config.maxContentLength > -1 && Buffer.concat(responseBuffer).length > config.maxContentLength) {
            stream.destroy();
            reject(createError('maxContentLength size of ' + config.maxContentLength + ' exceeded',
              config, null, lastRequest));
          }
        });

        stream.on('error', function handleStreamError(err) {
          if (req.aborted) return;
          reject(enhanceError(err, config, null, lastRequest));
        });

        stream.on('end', function handleStreamEnd() {
          var responseData = Buffer.concat(responseBuffer);
          if (config.responseType !== 'arraybuffer') {
            responseData = responseData.toString(config.responseEncoding);
          }

          response.data = responseData;
          settle(resolve, reject, response);
        });
      }
    });

    // Handle errors
    // 处理error
    req.on('error', function handleRequestError(err) {
      if (req.aborted && err.code !== 'ERR_FR_TOO_MANY_REDIRECTS') return;
      reject(enhanceError(err, config, null, req));
    });

    // Handle request timeout
    // 处理超时
    if (config.timeout) {
      // Sometime, the response will be very slow, and does not respond, the connect event will be block by event loop system.
      // And timer callback will be fired, and abort() will be invoked before connection, then get "socket hang up" and code ECONNRESET.
      // At this time, if we have a large number of request, nodejs will hang up some socket on background. and the number will up and up.
      // And then these socket which be hang up will devoring CPU little by little.
      // ClientRequest.setTimeout will be fired on the specify milliseconds, and can make sure that abort() will be fired after connect.
      req.setTimeout(config.timeout, function handleRequestTimeout() {
        req.abort();
        reject(createError('timeout of ' + config.timeout + 'ms exceeded', config, 'ECONNABORTED', req));
      });
    }

    // 处理取消
    if (config.cancelToken) {
      // Handle cancellation
      config.cancelToken.promise.then(function onCanceled(cancel) {
        if (req.aborted) return;

        req.abort();
        reject(cancel);
      });
    }

    // Send the request
    // 发送request？？？
    if (utils.isStream(data)) {
      data.on('error', function handleStreamError(err) {
        reject(enhanceError(err, config, null, req));
      }).pipe(req);
    } else {
      req.end(data);
    }
  });
};
