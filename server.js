var express = require('express');
var app = express();
var stylus = require('stylus');
var nib = require('nib');

app.set('view engine', 'jade');
app.set('views', __dirname + '/views');

app.use(stylus.middleware({
  src: __dirname + '/public',
  compile: function(str, path) {
    return stylus(str).set('filename', path).use(nib());
  }
}));
app.use(express.static(__dirname + "/public"));

app.get('/', function(req, res) {
  res.render('index');
});

var server = app.listen(8059, function() {
  console.log('listening on ', server.address().address, server.address().port)
});
