var _ = require('underscore');
var contentful = require('contentful').createClient({
  accessToken: 'd44cabd88230f2f6481635c7d23f71458d69b437b05fa54a2829b293e9c3ed84',
  space: '1u2re2dai4xg'
});
var marked = require('marked');
var cLink = require('./contentful.json');
var cLinkInverted = _.invert(cLink);

var entries = contentful.entries();
var lastUpdate = Date.now()

function processEntry(entry, locale) {
  _.each(entry.fields, function(value, key) {
    if (key.match(/_nb$/) && locale == 'nb') 
      entry.fields[key.replace(/_nb$/, '')] = marked(entry.fields[key]);
    else if (key.match(/_en$/) && locale == 'en') 
      entry.fields[key.replace(/_en$/, '')] = marked(entry.fields[key]);
    else if (Array.isArray(value)) {
      value.forEach(function(value) {
        processEntry(value, locale);
      });
    }
  });
}

module.exports = function getData(fields, locale, callback) {
  var fieldIds = fields.map(function(field) { return cLink[field] });
  var collected = {};
  if (Date.now() - lastUpdate > 10000) entries = contentful.entries();
  entries.then(function(entries) {
    entries.forEach(function(entry) {
      if (!~fieldIds.indexOf(entry.sys.id)) return;
      processEntry(entry, locale);
      collected[cLinkInverted[entry.sys.id]] = entry;
    });
    callback(null, collected);
  }, function(err) {
    callback(err);
  });
};
