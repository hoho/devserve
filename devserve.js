// Originally written by Yuri Maly.

module.exports = function devServe(config, base, port) {
    var fs = require('fs'),
        path = require('path'),
        url = require('url'),
        http = require('http'),
        https = require('https'),
        colors = require('colors');

    var serverPort = port || +process.env.SERVER_PORT || 8080,
        router = [],
        FILE_LOG = '[%s]'.magenta + ' %s '.green + '<- %s'.grey,
        PROXY_LOG = '[%s]'.magenta + ' %s '.green + '<->'.grey + ' %s%s = '.grey + '%s'.cyan;

    base = path.resolve(base || '.');


    function rel(f) {
        return path.join(base, f.replace(/^\//, ''));
    }


    Object.keys(config)
        .sort(function(a, b) { return b.length - a.length; })
        .forEach(function(p) {
            var location = config[p],
                dir = location.dir,
                file = location.file,
                proxy = location.proxy;

            if (dir) {
                dir = rel(dir);
                console.log(' directory [%s] -> %s'.blue, p, path.resolve(dir));
                router.push({
                    location: p,
                    handler: function _directory(i, o) {
                        var src = path.join(dir, url.parse(i.url.substr(p.length)).pathname || '');
                        console.log(FILE_LOG, i.method, i.url, src);
                        if (fs.existsSync(src)) {
                            fs.createReadStream(src)
                                .on('error', function _405() { o.statusCode = 405; o.end(); })
                                .pipe(o);
                        } else {
                            o.statusCode = 404;
                            o.end('Not Found');
                        }
                    }
                });
            }

            if (file) {
                file = rel(file);
                console.log(' file [%s] -> %s'.blue, p, path.resolve(file));
                router.push({
                    location: p,
                    handler: function _file(i, o) {
                        console.log(FILE_LOG, i.method, i.url, file);
                        fs.createReadStream(file)
                            .on('error', function _409() {
                                o.statusCode = 409;
                                o.end('Cannot read file');
                            })
                            .pipe(o);
                    }
                });
            }

            if (proxy) {
                if(typeof proxy !== 'string') {
                    var dev = proxy.development || proxy.testing || proxy[Object.keys(proxy)[0]];
                    proxy = process.env.PROXY_URL || dev.url;
                }

                var proxyUrl = url.parse(proxy),
                    request = proxyUrl.protocol === 'https:' ? https : http,
                    alias = proxy.substr(-1) === '/' || proxyUrl.path !== '/' ? proxyUrl.path : false;

                console.log(' proxy [%s] -> %s'.blue, p, proxy);
                router.push({
                    location: p,
                    handler: function _proxy(i, o) {
                        var ur = i.url,
                            dst = alias ? url.resolve(alias, ur.substr(p.length)) : ur;

                        i.headers.host = proxyUrl.host;
                        i.pipe(request
                                .request({
                                    method: i.method,
                                    hostname: proxyUrl.hostname,
                                    port: proxyUrl.port,
                                    path: dst,
                                    headers: i.headers
                                })
                                .on('response', function proxy_response(resp) {
                                    console.log(PROXY_LOG, i.method,
                                        url.parse(ur).pathname, proxyUrl.host, url.parse(dst).pathname, resp.statusCode);
                                    o.statusCode = resp.statusCode;
                                    for (var header in resp.headers || {}) {
                                        o.setHeader(header, resp.headers[header]);
                                    }
                                    resp.pipe(o);
                                })
                                .on('error', function proxy_error(e) {
                                    console.error('[%s] %s: %s'.red, i.method, i.url, e.stack);
                                    o.statusCode = 503;
                                    o.end('Proxy error: ' + e.message + '\n');
                                })
                        );
                    }
                });
            }
        });

    router.push({
        location: '',
        handler: function _501(i, o) {
            console.error('[%s] %s: no handler!'.red, i.method, i.url);
            o.statusCode = 501;
            o.end('(!) No handler\n');
        }
    });

    return http
        .createServer(function _serve(req, res) {
            var ur = req.url = url.resolve('/', req.url);
            //console.log('[%s] %s', req.method, req.url);
            try {
                router.filter(function (a) {
                    return ur.substr(0, a.location.length) === a.location;
                })[0].handler(req, res);
            } catch (ex) {
                console.error('[%s] %s: %s'.red, req.method, req.url, ex.stack);
                res.statusCode = 500;
                res.end(ex + '\n');
            }
        })
        .on('clientError', function _err(e) {  })
        .listen(serverPort, '127.0.0.1', function _ok() {
            console.log(('=> http://localhost:' + serverPort).blue);
        });
};
