/*
* Base 64 URL functions
*/

exports.safe = function(b64data) {
  return b64data.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

exports.b64 = function(b64data) {
  return b64data.replace(/\-/g, '+').replace(/\_/g, '/')
}


exports.encode = function(data) {
  var buf = data
  if (!(data instanceof Buffer)) {
    buf = new Buffer(Buffer.byteLength(data))
    buf.write(data)
  }
  return exports.safe(buf.toString('base64'))
}

exports.decode = function(data, encoding) {
  encoding = encoding === undefined ? 'utf8' : encoding
  var buf = new Buffer(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
  if (!encoding) return buf
  return buf.toString(encoding)
}

exports.valid = function(s) {
    var invalid = /[^\w\-] /.exec(s);   // likely a more efficient way to do this
    return !invalid;
}