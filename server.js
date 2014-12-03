var express = require('express');
var app = express();
var stylus = require('stylus');
var nib = require('nib');
var request = require('request');
var moment = require('moment')
var _ = require('underscore');
var SpotifyWebApi = require('spotify-web-api-node');
var data = require('./data');
var locale = require('locale');
var strings = require('./strings.json');

var spotify = new SpotifyWebApi({
  clientId: '28f48569ef90450fb4b263a93e7ae19e',
  clientSecret: 'bbe1b0f25a5446b49d486f7f3abb1acc'
});

app.set('view engine', 'jade');
app.set('views', __dirname + '/views');

app.use(stylus.middleware({
  src: __dirname + '/public',
  compile: function(str, path) {
    return stylus(str).set('filename', path).use(nib());
  }
}));
app.use(express.static(__dirname + "/public"));
app.use(locale(['en', 'nb']));
app.use(function(req, res, next) {
  if (req.query.locale == 'nb' || req.query.locale == 'en') req.locale = req.query.locale;
  if (!req.locale) req.locale = 'nb';
  res.locals = _.extend(res.locals, strings[req.locale]);
  res.locals.locale = req.locale;
  next();
});

moment.locale('nb')

app.locals.events = [];

function parseEvent(event) {
  if (_.find(app.locals.events, function(event0) { return event0.id == event.id })) return;
  var startUnix = moment(event.start_time).unix();
  var relevantUnix = event.end_time ? moment(event.end_time).unix() : startUnix;
  if (relevantUnix < moment().unix()) return; // old event
  var parsed = {
    id: event.id,
    name: event.name,
    start: startUnix,
    location: event.location,
    link: 'https://www.facebook.com/events/' + event.id
  };
  if (!event.end_time) {
    parsed.when = {
      nb: moment(event.start_time).locale('nb').format('LT, Do MMMM'),
      en: moment(event.start_time).locale('en').format('LT, Do MMMM')
    }
  } else {
    var start = moment(event.start_time), end = moment(event.end_time);
    if (start.dayOfYear() == end.dayOfYear()) {
      parsed.when = {
        nb: start.locale('nb').format('LT') + '-' + end.locale('nb').format('LT, Do MMMM'),
        en: start.locale('en').format('LT') + '-' + end.locale('en').format('LT, Do MMMM')
      };
    } else {
      parsed.when = {
        nb: start.locale('nb').format('Do MMMM') + '-' + end.locale('nb').format('Do MMMM'),
        en: start.locale('en').format('Do MMMM') + '-' + end.locale('en').format('Do MMMM')
      };
    }
  }
  app.locals.events.push(parsed);
  app.locals.events = _.sortBy(app.locals.events, function(event) { return event.start });
}

function readEvent(token, id) {
  request('https://graph.facebook.com/' + id + '?' + token, function(err, res) {
    if (err) return;
    var event = JSON.parse(res.body);
    parseEvent(event);
  });
}

var accessTokenUrl = "https://graph.facebook.com/oauth/access_token?grant_type=client_credentials&client_id=825246320872863&client_secret=e996a8d5a7534d69e0020ccb84774536";
request(accessTokenUrl, function(err, res) {
  if (err) return;
  var token = res.body;
  request('https://graph.facebook.com/cottontailsdanseklubb/posts?' + token, function(err, res) {
    if (err) return;
    var body = JSON.parse(res.body);
    app.locals.stories = body.data.filter(function(post) {
      if (post.link) {
        var eventMatch = post.link.match(/events\/(\d+)/);
        if (eventMatch) {
          readEvent(token, eventMatch[1]);
        }
      }
      return !!post.message
    }).map(function(post) {
      return {
        story: post.message,
        date: {
          nb: moment(post.created_time).locale('nb').format('Do MMMM'),
          en: moment(post.created_time).locale('en').format('Do MMMM')
        },
        link: post.link
      };
    }).slice(0,5);
  });
  request('https://graph.facebook.com/cottontailsdanseklubb/events?' + token, function(err, res) {
    if (err) return;
    var body = JSON.parse(res.body);
    body.data.forEach(function(event) {
      parseEvent(event)
    })
  });
});

spotify.clientCredentialsGrant().then(function(data) {
  spotify.setAccessToken(data['access_token']);
  spotify.getUserPlaylists('thecottontails').then(function(data) {
    app.locals.playlists = data.items;
    app.locals.playlists.forEach(function(playlist) {
      spotify.getUser(encodeURIComponent(playlist.owner.id)).then(function(user) {
        playlist.owner.display_name = user.display_name;
      }, function(err) { console.log('couldnt fetch', playlist.owner.id, err) });
    });
  }, function(err) { console.log('failed to get playlists', err) });
}, function(err) { console.log('failed to grant client credentials', err) });

app.get('/', function(req, res) {
  data([
    'club_overview_text',
    'schedule',
    'asylbarnehagen'
  ], req.locale, function(e, locals) {
    if (e) return res.send(500, e);
    res.render('index', locals);
  });
});

app.get('/kurs', function(req, res) {
  res.locals.current = 'courses';
  res.render('kurs');
});

app.get('/lokaler', function(req, res) {
  res.locals.current = 'locations';
  data([
    'asylbarnehagen'
  ], req.locale, function(e, locals) {
    if (e) return res.send(500, e);
    res.render('lokaler', locals);
  });
});

app.get('/hvaskjer', function(req, res) {
  res.locals.current = 'events';
  res.render('events');
});

app.get('/om', function(req, res) {
  res.locals.current = 'about';
  res.render('about');
});

app.get('/musikk', function(req, res) {
  res.locals.current = 'music';
  res.render('music');
});

var server = app.listen(8059, function() {
  console.log('listening on ', server.address().address, server.address().port)
});
