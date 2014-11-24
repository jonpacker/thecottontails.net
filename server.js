var express = require('express');
var app = express();
var stylus = require('stylus');
var nib = require('nib');
var request = require('request');
var moment = require('moment')

app.set('view engine', 'jade');
app.set('views', __dirname + '/views');

app.use(stylus.middleware({
  src: __dirname + '/public',
  compile: function(str, path) {
    return stylus(str).set('filename', path).use(nib());
  }
}));
app.use(express.static(__dirname + "/public"));

moment.locale('nb')

var accessTokenUrl = "https://graph.facebook.com/oauth/access_token?grant_type=client_credentials&client_id=825246320872863&client_secret=e996a8d5a7534d69e0020ccb84774536";
request(accessTokenUrl, function(err, res) {
  if (err) return;
  var token = res.body;
  request('https://graph.facebook.com/cottontailsdanseklubb/posts?' + token, function(err, res) {
    if (err) return;
    var body = JSON.parse(res.body);
    app.locals.stories = body.data.filter(function(post) {
      return !!post.message
    }).map(function(post) {
      return {
        story: post.message,
        date: moment(post.created_time).format('Do MMMM'),
        link: post.link
      };
    }).slice(0,5);
  });
  request('https://graph.facebook.com/cottontailsdanseklubb/events?' + token, function(err, res) {
    if (err) return;
    var body = JSON.parse(res.body);
    app.locals.events = body.data.map(function(event) {
      var parsed = {
        name: event.name,
        location: event.location,
      };
      if (!event.end_time) {
        parsed.when = moment(event.start_time).format('LT, Do MMMM')
      } else {
        var start = moment(event.start_time), end = moment(event.end_time);
        if (start.dayOfYear() == end.dayOfYear()) {
          parsed.when = start.format('LT') + '-' + end.format('LT, Do MMMM');
        } else {
          parsed.when = start.format('Do MMMM') + '-' + end.format('Do MMMM');
        }
      }
      return parsed;
    });
  });
});


app.get('/', function(req, res) {
  res.render('index');
});

app.get('/kurs', function(req, res) {
  res.render('kurs');
});

app.get('/lokaler', function(req, res) {
  res.render('lokaler');
});

var server = app.listen(8059, function() {
  console.log('listening on ', server.address().address, server.address().port)
});
