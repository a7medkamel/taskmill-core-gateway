# etag and caching code

## Task::ctor
```
this.etag = {
    code : undefined
  , type : undefined
};

this.cache = parser(req.get('cache-control')) || {};

if (this.cache.private && this.cache.log) {
  this.etag = {
      code  : this.id
    , type  : 'instance'
  };
} else if (req.method === 'GET') {
  this.etag = {
      code  : sha1(this.req.url)
    , type  : 'public'
  };
}
```

## Task::make_headers
```
if (this.etag.type === 'public') {
  // don't cache if:
  // 1- there is no cache header in res
  // 1- the header has Age [means it came from cache server]
  // 1- the max-age is <= 0
  // 1- the cache is marked private
  // var cache           = parser(res.getHeader('cache-control')) || {}
  var cache           = parser(response.headers['cache-control']) || {}
    , max_age         = Math.max(cache['max-age'] || 0, 0)
    , is_public       = !!cache.public
    , is_from_cache   = !_.isUndefined(response.headers['Age'])
    , is_err          = response.statusCode >= 400 && response.statusCode < 600
    ;
  if (is_from_cache || !max_age || !is_public || is_err) {
    this.etag.code = undefined;
    // this.etag.type = undefined;
  }
}

if (this.etag.type === 'instance') {
  headers['cache-control'] = 'private, log, max-age=120';
}

// let is_err = response.statusCode >= 400 && response.statusCode < 600;
// cache_bust if err or no cache-control is set
if (is_err || !this.cache) {
  headers['cache-control'] = 'no-cache';
}
```