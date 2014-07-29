# dev-serve

Specific single page application dev server with proxy to backend capabilities.

## Install

`npm install -g devserve`


## Running as command line utility

```
devserve --file /=index.html --proxy /api/=http://myapi:3333/ --dir /static/=static --base /home/hoho/www --port=3001
```

This command will run server on port `3001`. For URIs starting with `/static/`
it will serve files from `/home/hoho/www/static` folder, for URIs starting with
`/api/` it will cut off `/api` prefix and proxy the rest to `http://myapi:3333/`,
for other URIs it will serve `/home/hoho/www/index.html`.


## Running as part of Node.JS application

```js
devServe = require('devserve');

devServe({
    '/': {file: 'index.html'},
    '/api/': {proxy: 'http://myapi:3333/'},
    '/static/': {dir: 'static'}
}, '/home/hoho/www', 3001);
```

This code will do the same as command line example above.

Base direcrory and port are optional, current working directory and `8080` are
used by default.
