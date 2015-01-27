var express = require('express');
var app = express();
var stylus = require('stylus');
var nib = require('nib');
var moment = require('moment')
var _ = require('underscore');
var data = require('./data');
var locale = require('locale');
var strings = require('./strings.json');
var fs = require('fs');
var session = require('express-session');
var basicAuth = require('basic-auth-connect');

app.set('view engine', 'jade');
app.set('views', __dirname + '/views');

app.use(stylus.middleware({
  src: __dirname + '/public',
  compile: function(str, path) {
    return stylus(str).set('filename', path).use(nib());
  }
}));
app.use(session({
  secret: '1d2d0863-55c6-451f-ac1c-c589d5c9a3a3',
  resave: false,
  saveUninitialized: true
}));
app.use(express.static(__dirname + "/public"));
app.use(locale(['en', 'nb']));
app.use(function(req, res, next) {
  if (req.query.locale == 'nb' || req.query.locale == 'en') {
    req.session.locale = req.query.locale;
  }
  if (!req.session.locale) {
    req.session.locale = req.locale || 'nb';
  }
  res.locals = _.extend(res.locals, strings[req.session.locale]);
  res.locals.locale = req.session.locale;
  next();
});

moment.locale('nb')

app.locals._ = _;
app.locals.moment = require('moment')

require('./social_data')(app);

app.get('/', function(req, res) {
  data([
    'club_overview_text',
    'schedule',
    'asylbarnehagen',
    'lagshuset'
  ], req.session.locale, function(e, locals) {
    if (e) return res.send(500, e);
    res.render('index', locals);
  });
});

app.get('/kurs', function(req, res) {
  res.locals.current = 'courses';
  data([
    'level_overview',
    'course_overview',
    'levels',
    'schedule'
  ], req.session.locale, function(e, locals) {
    if (e) return res.send(500, e);
    res.render('kurs', locals);
  });
});

app.get('/registration', function(req, res) {
  res.locals.current = 'courses';
  data([
    'levels'
  ], req.session.locale, function(e, locals) {
    if (e) return res.send(500, e);
    res.render('registration', locals);
  });
});

app.post('/registration/:event', require('body-parser').urlencoded({extended:false}), function(req, res) {
  var eventFile = 'event_' + req.params.event + '.json';
  fs.readFile(eventFile, {encoding: 'utf8'}, function(err, contents) {
    var registrations;
    if (err) {
      if (err.code == 'ENOENT') {
        registrations = [];
      } else {
        return res.send(500);
      }
    }

    if (!registrations) registrations = JSON.parse(contents);

    registrations.push(req.body);
    console.log(req.body);

    fs.writeFile(eventFile, JSON.stringify(registrations), { encoding: 'utf8' }, function(err) {
      if (err) return res.send(500, 'registration failed');
      res.locals.current = 'kurs';
      data([
        'reg_ok'
      ], req.session.locale, function(e, locals) {
        if (e) return res.send(500, e);
        locals = _.extend(locals, req.body);
        res.render('registration_ok', locals);
      });
    });
    
  });
});

var passwd = fs.readFileSync(__dirname + '/passwd', {encoding:'utf8'}).trim();
app.get('/registrations/:event', basicAuth('cottontails', passwd), function(req, res) {
  var eventFile = 'event_' + req.params.event + '.json';
  fs.readFile(eventFile, {encoding:'utf8'}, function(err, contents) {
    if (err) return res.send(404);

    var registrations = JSON.parse(contents);
    res.render('registration_list', {registrations: registrations});
  });
});

app.get('/lokaler', function(req, res) {
  res.locals.current = 'locations';
  data([
    'asylbarnehagen',
    'lagshuset'
  ], req.session.locale, function(e, locals) {
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
  data([
    'about_cottontails',
    'about_lindy_hop',
    'about_balboa',
    'about_authentic_jazz',
    'about_collegiate_shag'
  ], req.session.locale, function(e, locals) {
    if (e) return res.send(500, e);
    res.render('about', locals);
  });
});

app.get('/musikk', function(req, res) {
  res.locals.current = 'music';
  res.render('music');
});

var server = app.listen(process.env.NODE_ENV == 'production' ? 80 : 8059, function() {
  console.log('listening on ', server.address().address, server.address().port)
});
