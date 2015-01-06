var request = require('request');
var moment = require('moment')
require('moment-timezone');
var _ = require('underscore');
var SpotifyWebApi = require('spotify-web-api-node');

module.exports = function(app) {
  var spotify = new SpotifyWebApi({
    clientId: '28f48569ef90450fb4b263a93e7ae19e',
    clientSecret: 'bbe1b0f25a5446b49d486f7f3abb1acc'
  });

  app.locals.events = [];

  function parseEvent(event) {
    if (_.find(app.locals.events, function(event0) { return event0.id == event.id })) return;
    var startTime = moment(event.start_time).tz('Europe/Oslo');
    var startUnix = startTime.unix();
    var relevantUnix = event.end_time ? moment(event.end_time).tz('Europe/Oslo').unix() : startUnix;
    if (relevantUnix < moment().tz('Europe/Oslo').unix()) return; // old event
    var parsed = {
      id: event.id,
      name: event.name,
      start: startUnix,
      location: event.location,
      link: 'https://www.facebook.com/events/' + event.id
    };
    if (!event.end_time) {
      parsed.when = {
        nb: startTime.locale('nb').format('LT, Do MMMM'),
        en: startTime.locale('en').format('LT, Do MMMM')
      }
    } else {
      var endTime = moment(event.end_time).tz('Europe/Oslo');
      if (startTime.dayOfYear() == endTime.dayOfYear()) {
        parsed.when = {
          nb: startTime.locale('nb').format('LT') + '-' + endTime.locale('nb').format('LT, Do MMMM'),
          en: startTime.locale('en').format('LT') + '-' + endTime.locale('en').format('LT, Do MMMM')
        };
      } else {
        parsed.when = {
          nb: startTime.locale('nb').format('Do MMMM') + '-' + endTime.locale('nb').format('Do MMMM'),
          en: startTime.locale('en').format('Do MMMM') + '-' + endTime.locale('en').format('Do MMMM')
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

  function updateSocialData() {
    var facebookAccessTokenUrl = "https://graph.facebook.com/oauth/access_token?grant_type=client_credentials&client_id=825246320872863&client_secret=e996a8d5a7534d69e0020ccb84774536";
    request(facebookAccessTokenUrl, function(err, res) {
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
          var created = moment(post.created_time).tz('Europe/Oslo');
          return {
            story: post.message,
            date: {
              nb: created.locale('nb').format('Do MMMM'),
              en: created.locale('en').format('Do MMMM')
            },
            created: created,
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
  };

  updateSocialData();
  setInterval(updateSocialData, 120000);
};
