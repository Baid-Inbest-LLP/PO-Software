const app = require('../server/server');

// Every /api/* request is routed here, so the requested path is forwarded as __poPath and
// restored before Express routes it. This keeps routing correct whether the platform hands
// us the original URL or this file's path.
const PATH_PARAM = '__poPath';

module.exports = (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  const forwardedPath = url.searchParams.get(PATH_PARAM);

  if (forwardedPath !== null) {
    url.searchParams.delete(PATH_PARAM);
    const query = url.searchParams.toString();
    req.url = `/api/${forwardedPath}${query ? `?${query}` : ''}`;
  }

  return app(req, res);
};
