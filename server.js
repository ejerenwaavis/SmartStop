// -----------------------------------------
// SmartStop Server
// -----------------------------------------

// Load .env in non-production environments
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const ADMINPASS      = process.env.ADMINPASS;
const ADMINCONSOLE   = process.env.ADMINCONSOLE;
const ADMIN_SEED_ID  = process.env.ADMIN_SEED_ID || '';
const ADMIN_SEED_NAME = process.env.ADMIN_SEED_NAME || 'SmartStop Admin';
const CLIENT_ID      = process.env.CLIENT_ID;
const CLIENT_SECRET  = process.env.CLIENT_SECRET || process.env.CLIENT_SECRETE;
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.SECRETE;
const APP_DIRECTORY  = process.env.APP_DIRECTORY || '';
const BASE_URL       = process.env.BASE_URL || '';
const DEBUG_API      = (process.env.DEBUG_API || '').toLowerCase() === 'true';
const ADMIN_EMAILS   = (process.env.ADMIN_EMAILS || '').split(',').map(function(e) { return e.trim().toLowerCase(); }).filter(Boolean);
const GOOGLE_MAPS_PLATFORM_API = (process.env.GOOGLE_MAPS_PLATFORM_API || '').trim();

const express              = require('express');
const https                = require('https');
const crypto               = require('crypto');
const helmet               = require('helmet');
const rateLimit            = require('express-rate-limit');
const bodyParser           = require('body-parser');
const compression          = require('compression');
const mongoose             = require('mongoose');
const _                    = require('lodash');
const session              = require('express-session');
const passport             = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy       = require('passport-google-oauth20').Strategy;

const app = express();

// -- Middleware
app.set('view engine', 'ejs');
app.locals.googleMapsApiKey = GOOGLE_MAPS_PLATFORM_API; // exposed to all EJS templates for client-side Places Autocomplete
app.set('trust proxy', 1); // required behind Heroku/reverse-proxy for rate limiting and secure cookies
app.use(helmet({ contentSecurityPolicy: false })); // CSP disabled — tune separately per deployment
app.use(compression());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
if (APP_DIRECTORY) {
  app.use(APP_DIRECTORY, express.static('public'));
} else {
  // When deployed at domain root (no APP_DIRECTORY), redirect any legacy
  // /smartstop/* paths so old bookmarks and links still work.
  app.use(function(req, res, next) {
    var m = req.path.match(/^\/smartstop(\/.*)?$/);
    if (m) {
      var tail = m[1] || '/';
      var qs = req.url.slice(req.path.length);
      return res.redirect(301, tail + qs);
    }
    next();
  });
}
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000  // 8-hour session
  }
}));
app.use(passport.initialize());
app.use(passport.session());

// -- Database
const mongoUri = process.env.MONGODB_URI;
mongoose.connect(mongoUri).catch(function(err) { console.error('MongoDB connection error:', err); });

// -- Schemas & Models
const userSchema = new mongoose.Schema({
  username: String,
  _id: String,
  verified: { type: Boolean, default: false }
});
userSchema.plugin(passportLocalMongoose);

const communitySchema = new mongoose.Schema({
  communityName: { type: String, index: true },
  streets:       { type: [String], index: true },
  city:          String,
  stateCode:     String,
  gateCodes:     [{ description: String, code: String }]
});

const User      = mongoose.model('User', userSchema);
const Community = mongoose.model('Community', communitySchema);

const pendingCodeSchema = new mongoose.Schema({
  street:              { type: String, required: true },
  city:                String,
  stateCode:           String,
  postalCode:          String,
  gateCodeDescription: String,
  gateCode:            String,
  submittedAt:         { type: Date, default: Date.now }
});
const PendingCode = mongoose.model('PendingCode', pendingCodeSchema);

async function seedAdminIfConfigured() {
  if (!ADMIN_SEED_ID) return;
  try {
    const existing = await User.findById(ADMIN_SEED_ID);
    if (existing) {
      if (!existing.verified) {
        existing.verified = true;
        await existing.save();
        console.log('[seed] Existing admin was unverified and is now verified:', ADMIN_SEED_ID);
      } else {
        console.log('[seed] Admin already exists and is verified:', ADMIN_SEED_ID);
      }
      return;
    }

    await new User({
      _id: ADMIN_SEED_ID,
      username: ADMIN_SEED_NAME,
      verified: true
    }).save();
    console.log('[seed] Admin user created:', ADMIN_SEED_ID);
  } catch (err) {
    console.error('[seed] Failed to seed admin user:', err.message);
  }
}

mongoose.connection.once('open', function() {
  seedAdminIfConfigured();
});

// -- Passport
passport.use(User.createStrategy());
passport.serializeUser(function(user, done) { done(null, user); });
passport.deserializeUser(function(user, done) { done(null, user); });

passport.use(new GoogleStrategy(
  {
    clientID:       CLIENT_ID,
    clientSecret:   CLIENT_SECRET,
    callbackURL:    BASE_URL + APP_DIRECTORY + '/loggedIn',
    userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo'
  },
  async function(accessToken, refreshToken, profile, cb) {
    const p = profile._json || {};
    const sub = p.sub;
    const email = (p.email || (profile.emails && profile.emails[0] && profile.emails[0].value) || '').toLowerCase();
    const isWhitelistedEmail = ADMIN_EMAILS.length > 0 && ADMIN_EMAILS.includes(email);
    debugLog('/auth/google profile', { sub, email, whitelisted: isWhitelistedEmail });
    try {
      let user = await User.findById(sub);
      if (user) {
        if (!user.verified && isWhitelistedEmail) {
          user.verified = true;
          await user.save();
        }
        return user.verified ? cb(null, user) : cb(null, false);
      }
      const newUser = new User({ username: p.name || email || 'Unknown User', _id: sub, verified: isWhitelistedEmail });
      await newUser.save();
      return cb(null, isWhitelistedEmail ? newUser : false);
    } catch (err) {
      return cb(err);
    }
  }
));

// -- Helpers
function sanitize(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[<>"'&]/g, function(c) {
    return { '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '&': '&amp;' }[c];
  });
}

function makeBody(title, error, message) {
  return { title: title, error: error || '', message: message || '', domain: APP_DIRECTORY };
}

function requireAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect(APP_DIRECTORY + '/login');
}

function debugLog() {
  if (!DEBUG_API) return;
  const args = Array.prototype.slice.call(arguments);
  console.log.apply(console, ['[debug]'].concat(args));
}

function safeCompare(a, b) {
  try {
    var ab = Buffer.from(String(a));
    var bb = Buffer.from(String(b));
    if (ab.length !== bb.length) return false;
    return crypto.timingSafeEqual(ab, bb);
  } catch (e) {
    return false;
  }
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests. Please try again later.'
});

// -- Nominatim (OpenStreetMap) geocoding helpers — no API key required
const NOMINATIM_USER_AGENT = 'SmartStopApp/1.0 (internal-tool)';
const GOOGLE_STREET_CACHE_TTL_MS = 10 * 60 * 1000;
const googleStreetSuggestCache = new Map();

function nominatimReverseGeocode(lat, lon) {
  return new Promise(function(resolve, reject) {
    var url = 'https://nominatim.openstreetmap.org/reverse?lat=' + lat + '&lon=' + lon + '&format=json&addressdetails=1';
    var options = {
      hostname: 'nominatim.openstreetmap.org',
      path: '/reverse?lat=' + lat + '&lon=' + lon + '&format=json&addressdetails=1',
      method: 'GET',
      headers: {
        'User-Agent': NOMINATIM_USER_AGENT,
        'Accept-Language': 'en'
      }
    };
    var req = https.request(options, function(res) {
      var raw = '';
      res.on('data', function(chunk) { raw += chunk; });
      res.on('end', function() {
        try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function nominatimForwardGeocode(query) {
  return new Promise(function(resolve, reject) {
    var options = {
      hostname: 'nominatim.openstreetmap.org',
      path: '/search?q=' + encodeURIComponent(query) + '&format=json&addressdetails=1&limit=1',
      method: 'GET',
      headers: {
        'User-Agent': NOMINATIM_USER_AGENT,
        'Accept-Language': 'en'
      }
    };
    var req = https.request(options, function(res) {
      var raw = '';
      res.on('data', function(chunk) { raw += chunk; });
      res.on('end', function() {
        try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function httpsPostJSON(options, body) {
  return new Promise(function(resolve, reject) {
    var req = https.request(options, function(res) {
      var raw = '';
      res.on('data', function(chunk) { raw += chunk; });
      res.on('end', function() {
        try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function nominatimAddressToHere(data) {
  // Normalise Nominatim reverse-geocode response into the shape the rest of the
  // app already expects (previously from HERE).  Returns null if no address.
  if (!data || !data.address) return null;
  var a = data.address;
  var street = a.road || a.pedestrian || a.footway || a.path || a.cycleway || '';
  var city   = a.city || a.town || a.village || a.municipality || a.suburb || a.hamlet || a.county || '';
  return {
    street:    street,
    city:      city,
    stateCode: a.state || '',
    postalCode: a.postcode || '',
    countryCode: (a.country_code || '').toUpperCase()
  };
}

// Expand common street abbreviations so Nominatim matches better
function expandStreetAbbreviation(name) {
  var abbrs = {
    'dr': 'Drive', 'st': 'Street', 'ave': 'Avenue', 'av': 'Avenue',
    'blvd': 'Boulevard', 'ln': 'Lane', 'ct': 'Court', 'rd': 'Road',
    'pl': 'Place', 'pkwy': 'Parkway', 'cir': 'Circle', 'hwy': 'Highway',
    'ter': 'Terrace', 'terr': 'Terrace', 'trl': 'Trail', 'fwy': 'Freeway'
  };
  var parts = name.trim().split(/\s+/);
  var last = parts[parts.length - 1].toLowerCase().replace(/\.$/, '');
  if (abbrs[last]) parts[parts.length - 1] = abbrs[last];
  return parts.join(' ');
}

function escapeRegExp(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function dedupeStreetSuggestions(items, limit) {
  var seen = {};
  var out = [];
  (items || []).forEach(function(item) {
    var street = String((item && item.street) || '').replace(/\s+/g, ' ').trim();
    var city = String((item && item.city) || '').replace(/\s+/g, ' ').trim();
    var state = String((item && item.state) || '').replace(/\s+/g, ' ').trim();
    if (!street) return;
    var key = [street.toLowerCase(), city.toLowerCase(), state.toLowerCase()].join('|');
    if (seen[key]) return;
    seen[key] = true;
    out.push({ street: street, city: city, state: state });
  });
  return typeof limit === 'number' ? out.slice(0, limit) : out;
}

function parseGoogleSecondaryAddress(secondaryText) {
  var bits = String(secondaryText || '').split(',').map(function(b) { return b.trim(); }).filter(Boolean);
  var city = bits[0] || '';
  var state = '';
  if (bits[1]) {
    state = bits[1].split(/\s+/)[0];
  }
  return { city: city, state: state };
}

async function getLocalStreetSuggestions(q, city, limit) {
  var streetQuery = String(q || '').trim();
  if (!streetQuery) return [];

  var streetRe = new RegExp('^' + escapeRegExp(streetQuery), 'i');
  var cityRe = city ? new RegExp('^' + escapeRegExp(city), 'i') : null;

  var communityQuery = { streets: { $regex: streetRe } };
  if (cityRe) communityQuery.city = { $regex: cityRe };

  var pendingQuery = { street: { $regex: streetRe } };
  if (cityRe) pendingQuery.city = { $regex: cityRe };

  var results = await Promise.all([
    Community.find(communityQuery, 'streets city stateCode').limit(40),
    PendingCode.find(pendingQuery, 'street city stateCode').limit(20)
  ]);

  var communityDocs = results[0] || [];
  var pendingDocs = results[1] || [];
  var local = [];

  communityDocs.forEach(function(doc) {
    (doc.streets || []).forEach(function(street) {
      if (!streetRe.test(street || '')) return;
      local.push({ street: street, city: doc.city || '', state: doc.stateCode || '' });
    });
  });

  pendingDocs.forEach(function(doc) {
    if (!doc.street || !streetRe.test(doc.street)) return;
    local.push({ street: doc.street, city: doc.city || '', state: doc.stateCode || '' });
  });

  local.sort(function(a, b) {
    var s = a.street.localeCompare(b.street);
    if (s !== 0) return s;
    var c = a.city.localeCompare(b.city);
    if (c !== 0) return c;
    return a.state.localeCompare(b.state);
  });

  return dedupeStreetSuggestions(local, limit || 8);
}

async function getGoogleStreetSuggestions(q, city, limit) {
  if (!GOOGLE_MAPS_PLATFORM_API) return [];

  var cacheKey = (String(q || '').trim() + '|' + String(city || '').trim()).toLowerCase();
  var cached = googleStreetSuggestCache.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < GOOGLE_STREET_CACHE_TTL_MS) {
    return cached.items.slice(0, limit || 6);
  }

  var input = city ? q + ', ' + city : q;
  var body = JSON.stringify({
    input: input,
    languageCode: 'en',
    includedRegionCodes: ['us']
  });

  var data = await httpsPostJSON(
    {
      hostname: 'places.googleapis.com',
      path: '/v1/places:autocomplete',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-Goog-Api-Key': GOOGLE_MAPS_PLATFORM_API,
        'X-Goog-FieldMask': 'suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text'
      }
    },
    body
  );

  var suggestions = [];
  (data.suggestions || []).forEach(function(item) {
    var p = item.placePrediction || {};
    var main = (((p.structuredFormat || {}).mainText || {}).text || '').trim();
    var secondary = (((p.structuredFormat || {}).secondaryText || {}).text || '').trim();
    var full = (((p.text || {}).text) || '').trim();
    var street = main || (full.split(',')[0] || '').trim();
    if (!street) return;

    var parsed = parseGoogleSecondaryAddress(secondary || full.split(',').slice(1).join(','));
    suggestions.push({
      street: street,
      city: parsed.city || city || '',
      state: parsed.state || ''
    });
  });

  suggestions = dedupeStreetSuggestions(suggestions, limit || 6);
  googleStreetSuggestCache.set(cacheKey, { ts: Date.now(), items: suggestions });
  return suggestions;
}

async function getNominatimStreetSuggestions(q, city, limit) {
  var query = city ? q + ', ' + city : q;
  var max = Math.max(6, limit || 6);
  var options = {
    hostname: 'nominatim.openstreetmap.org',
    path: '/search?q=' + encodeURIComponent(query) + '&format=json&addressdetails=1&limit=' + max,
    method: 'GET',
    headers: { 'User-Agent': NOMINATIM_USER_AGENT, 'Accept-Language': 'en' }
  };

  var results = await new Promise(function(resolve, reject) {
    var r = https.request(options, function(resp) {
      var raw = '';
      resp.on('data', function(c) { raw += c; });
      resp.on('end', function() {
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          reject(e);
        }
      });
    });
    r.on('error', reject);
    r.end();
  });

  var streets = [];
  (results || []).forEach(function(item) {
    if (!item.address) return;
    var road = item.address.road || item.address.pedestrian || item.address.footway || item.address.path || '';
    if (!road) return;
    var c = item.address.city || item.address.town || item.address.village || item.address.suburb || '';
    var s = item.address.state || '';
    streets.push({ street: road, city: c, state: s });
  });

  return dedupeStreetSuggestions(streets, limit || 6);
}

function mergeStreetSuggestions(local, remote, limit) {
  return dedupeStreetSuggestions((local || []).concat(remote || []), limit || 6);
}

// -- Routes

app.get(APP_DIRECTORY + '/', requireAuth, function(req, res) {
  res.render('home', { body: makeBody('SmartStop', '', '') });
});

app.get(APP_DIRECTORY + '/login', function(req, res) {
  res.render('login', { body: makeBody('Login', '', '') });
});

app.get(APP_DIRECTORY + '/auth/google',
  authLimiter,
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get(APP_DIRECTORY + '/loggedIn',
  passport.authenticate('google', { failureRedirect: APP_DIRECTORY + '/login' }),
  function(req, res) {
    res.redirect(APP_DIRECTORY + '/');
  }
);

app.get(APP_DIRECTORY + '/logout', function(req, res, next) {
  req.logout(function(err) {
    if (err) return next(err);
    res.redirect(APP_DIRECTORY + '/login');
  });
});

app.get(APP_DIRECTORY + '/locateJSON', requireAuth, async function(req, res) {
  var lat = parseFloat(req.query.lat);
  var lon = parseFloat(req.query.lon);
  if (isNaN(lat) || isNaN(lon)) return res.json({ error: 'Invalid coordinates' });
  try {
    var data     = await nominatimReverseGeocode(lat, lon);
    var location = nominatimAddressToHere(data);
    debugLog('/locateJSON', location);
    if (!location || !location.street) return res.json({ error: 'Could not determine your street. Search manually.' });
    var foundObj = await Community.find({ streets: location.street });
    if (foundObj[0]) {
      res.json({
        found:     true,
        community: { streets: foundObj[0].streets, communityName: foundObj[0].communityName, gateCodes: foundObj[0].gateCodes },
        location:  location
      });
    } else {
      res.json({ found: false, location: location });
    }
  } catch (err) {
    console.error('[locateJSON] error', err.message);
    res.json({ error: 'Location lookup failed. Please try again.' });
  }
});

app.get(APP_DIRECTORY + '/locate', function(req, res) {
  res.redirect(APP_DIRECTORY + '/');
});

app.post(APP_DIRECTORY + '/locate', requireAuth, async function(req, res) {
  var position = req.body.position;
  try {
    var parts = (position || '').split(',');
    var lat = parseFloat(parts[0]);
    var lon = parseFloat(parts[1]);
    debugLog('/locate request', { position: position, lat: lat, lon: lon });
    if (isNaN(lat) || isNaN(lon)) {
      return res.render('home', { body: makeBody('SmartStop', 'Invalid position data. Please try again.', '') });
    }
    var data = await nominatimReverseGeocode(lat, lon);
    var location = nominatimAddressToHere(data);
    debugLog('/locate Nominatim response', location);
    if (!location || !location.street) {
      return res.render('home', {
        body: makeBody('SmartStop', 'Location lookup failed. Search manually above.', '')
      });
    }
    var foundObj = await Community.find({ streets: location.street });
    if (foundObj[0]) {
      res.render('code', {
        body: makeBody('SmartStop', '', ''),
        community: { streets: foundObj[0].streets, communityName: foundObj[0].communityName, gateCodes: foundObj[0].gateCodes },
        location: location
      });
    } else {
      res.render('code', {
        body: makeBody('SmartStop', 'Unregistered Community', ''),
        community: { streets: [location.street], locationJSON: JSON.stringify(location), communityName: 'Unregistered', gateCodes: [] },
        location: location
      });
    }
  } catch (err) {
    res.render('home', { body: makeBody('SmartStop', 'Location lookup failed. Please try again.', '') });
  }
});

app.get(APP_DIRECTORY + '/search/:searchPhrase', requireAuth, async function(req, res) {
  var searchPhrase = _.startCase(_.toLower(req.params.searchPhrase));
  var escaped = searchPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var re = new RegExp('^' + escaped, 'i');
  try {
    var results = await Community.find(
      { $or: [{ streets: { $regex: re } }, { communityName: { $regex: re } }] },
      'communityName streets gateCodes'
    ).limit(10);
    res.json(results.length ? results : null);
  } catch (err) {
    res.json(null);
  }
});

app.get(APP_DIRECTORY + '/adminAdd', function(req, res) {
  res.redirect(APP_DIRECTORY + '/');
});

app.post(APP_DIRECTORY + '/adminAdd', requireAuth, async function(req, res) {
  if (!safeCompare(req.body.password, ADMINPASS)) {
    return res.render('adminAdd', {
      body: makeBody('Admin Add', 'Invalid password', ''),
      location: null
    });
  }
  var communityName = sanitize((req.body.communityName || '').trim() || '-- Missing Name --');
  var city          = sanitize((req.body.city || '').trim());
  var stateCode     = sanitize((req.body.stateCode || '').trim());
  var streets       = JSON.parse(req.body.streetsJSON).map(function(s) { return sanitize(s); });
  var gateCodes     = JSON.parse(req.body.gateCodesJSON).map(function(g) {
    return { description: sanitize(g.description), code: sanitize(g.code) };
  });

  try {
    var exists = await Community.exists({ communityName: communityName });
    if (!exists) {
      var saved = await new Community({ communityName: communityName, streets: streets, city: city, stateCode: stateCode, gateCodes: gateCodes }).save();
      res.render('adminAdd', {
        body: makeBody('Admin Add', '', 'Successfully added "' + saved.communityName + '"'),
        location: null
      });
    } else {
      await Community.findOneAndUpdate(
        { communityName: communityName },
        { $addToSet: { streets: { $each: streets }, gateCodes: { $each: gateCodes } } }
      );
      res.render('adminAdd', {
        body: makeBody('Admin', '', '"' + communityName + '" updated successfully'),
        location: null
      });
    }
  } catch (err) {
    console.error('[adminAdd] Database error:', err.message);
    res.render('adminAdd', {
      body: makeBody('Admin Add', 'Database error. Please try again.', ''),
      location: null
    });
  }
});

app.post(APP_DIRECTORY + '/resourceStreet', requireAuth, async function(req, res) {
  try {
    var parts = (req.body.position || '').split(',');
    var lat = parseFloat(parts[0]);
    var lon = parseFloat(parts[1]);
    debugLog('/resourceStreet request', { position: req.body.position, lat: lat, lon: lon });
    if (isNaN(lat) || isNaN(lon)) return res.send('');
    var data = await nominatimReverseGeocode(lat, lon);
    var location = nominatimAddressToHere(data);
    debugLog('/resourceStreet result', location);
    res.send((location && location.street) || '');
  } catch (err) {
    debugLog('/resourceStreet error', err.message);
    res.send('');
  }
});

app.post(APP_DIRECTORY + '/discoverStreets', requireAuth, async function(req, res) {
  var streetName = req.body.streetName;
  var city       = req.body.city;
  var state      = req.body.state;
  if (!streetName || !city) return res.json({ streets: [] });

  try {
    var q = streetName + ', ' + city + (state ? ', ' + state : '');
    debugLog('/discoverStreets geocode request', { streetName: streetName, city: city, state: state, q: q });
    var geoData = await nominatimForwardGeocode(q);

    if (!geoData || !geoData.length) {
      debugLog('/discoverStreets geocode returned no items');
      return res.json({ streets: [] });
    }

    var lat           = parseFloat(geoData[0].lat);
    var lng           = parseFloat(geoData[0].lon);
    var geoAddr       = geoData[0].address || {};
    var returnedCity  = geoAddr.city || geoAddr.town || geoAddr.village || city;
    var returnedState = geoAddr.state || state || '';

    var overpassQuery = '[out:json][timeout:25];way(around:800,' + lat + ',' + lng + ')["highway"]["name"];out body;';
    debugLog('/discoverStreets overpass query', overpassQuery);
    var overpassData  = await httpsPostJSON(
      {
        hostname: 'overpass-api.de',
        path:     '/api/interpreter',
        method:   'POST',
        headers:  { 'Content-Type': 'application/x-www-form-urlencoded' }
      },
      'data=' + encodeURIComponent(overpassQuery)
    );

    var seen    = new Set();
    var streets = (overpassData.elements || [])
      .map(function(e) { return e.tags && e.tags.name; })
      .filter(function(name) { return name && !seen.has(name) && seen.add(name); })
      .sort();

    debugLog('/discoverStreets streets found', streets.length);

    res.json({ streets: streets, city: returnedCity, state: returnedState });
  } catch (err) {
    debugLog('/discoverStreets error', err.message);
    res.json({ streets: [] });
  }
});

app.get(APP_DIRECTORY + '/streetSuggest', requireAuth, async function(req, res) {
  var q = (req.query.q || '').trim().split(',')[0].trim();
  if (q.length < 2) return res.json([]);
  try {
    var city = (req.query.city || '').trim();
    var local = await getLocalStreetSuggestions(q, city, 6);
    debugLog('/streetSuggest local', { q: q, city: city, count: local.length });
    res.json(local);
  } catch (err) {
    debugLog('/streetSuggest error', err.message);
    res.json([]);
  }
});

app.get(APP_DIRECTORY + '/adminInclude', requireAuth, function(req, res) {
  res.render('adminAdd', { body: makeBody('SmartStop | Admin', '', ''), location: null });
});

app.post(APP_DIRECTORY + '/adminInclude', requireAuth, function(req, res) {
  var rawLocation = (req.body && req.body.locationJSONString) ? String(req.body.locationJSONString).trim() : '';
  if (!rawLocation) {
    return res.render('home', {
      body: makeBody('SmartStop', 'Location data missing. Please click Re-locate and try again.', '')
    });
  }

  try {
    var location = JSON.parse(rawLocation);
    res.render('adminAdd', { body: makeBody('SmartStop | Admin', '', ''), location: location });
  } catch (err) {
    debugLog('/adminInclude invalid location JSON', rawLocation);
    res.render('home', {
      body: makeBody('SmartStop', 'Invalid location data. Please click Re-locate and try again.', '')
    });
  }
});

app.get(APP_DIRECTORY + '/adminConsole', requireAuth, async function(req, res) {
  try {
    var users = await User.find({});
    var pendingCodes = await PendingCode.find({}).sort({ submittedAt: -1 });
    res.render('adminConsole', { body: makeBody('Admin Console', '', ''), users: users || [], pendingCodes: pendingCodes || [] });
  } catch (err) {
    res.render('adminConsole', { body: makeBody('Admin Console', 'Unable to search the database', ''), users: [], pendingCodes: [] });
  }
});

app.post(APP_DIRECTORY + '/verifyUser', requireAuth, async function(req, res) {
  try {
    var r = await User.updateOne({ _id: req.body.userID }, { verified: true });
    res.json((r.modifiedCount || r.nModified || 0) > 0);
  } catch (err) {
    res.json(false);
  }
});

app.post(APP_DIRECTORY + '/restrictUser', requireAuth, async function(req, res) {
  try {
    var r = await User.updateOne({ _id: req.body.userID }, { verified: false });
    res.json((r.modifiedCount || r.nModified || 0) > 0);
  } catch (err) {
    res.json(false);
  }
});

app.post(APP_DIRECTORY + '/suggestCode', requireAuth, async function(req, res) {
  try {
    var street = sanitize((req.body.street || '').trim());
    var city = sanitize((req.body.city || '').trim());
    var stateCode = sanitize((req.body.stateCode || '').trim());
    var postalCode = sanitize((req.body.postalCode || '').trim());
    var description = sanitize((req.body.description || '').trim());
    var code = sanitize((req.body.code || '').trim());

    if (!street || !description || !code) {
      return res.json({ ok: false });
    }

    await new PendingCode({
      street: street,
      city: city,
      stateCode: stateCode,
      postalCode: postalCode,
      gateCodeDescription: description,
      gateCode: code
    }).save();

    res.json({ ok: true });
  } catch (err) {
    debugLog('/suggestCode error', err.message);
    res.json({ ok: false });
  }
});

app.post(APP_DIRECTORY + '/approveCode', requireAuth, async function(req, res) {
  try {
    var id = String((req.body && req.body.id) || '').trim();
    if (!id) return res.json({ ok: false });

    var pending = await PendingCode.findById(id);
    if (!pending) return res.json({ ok: false });

    var street = sanitize((pending.street || '').trim());
    var city = sanitize((pending.city || '').trim());
    var stateCode = sanitize((pending.stateCode || '').trim());
    var gateDescription = sanitize((pending.gateCodeDescription || 'Gate Code').trim());
    var gateCode = sanitize((pending.gateCode || '').trim());

    if (!street || !gateCode) return res.json({ ok: false });

    var community = await Community.findOne({ streets: street });
    if (community) {
      var duplicateGate = (community.gateCodes || []).some(function(g) {
        return String(g.description || '').toLowerCase() === gateDescription.toLowerCase() &&
               String(g.code || '') === gateCode;
      });

      if (!duplicateGate) {
        community.gateCodes.push({ description: gateDescription, code: gateCode });
      }
      if (!community.city && city) community.city = city;
      if (!community.stateCode && stateCode) community.stateCode = stateCode;
      await community.save();
    } else {
      await new Community({
        communityName: street,
        streets: [street],
        city: city,
        stateCode: stateCode,
        gateCodes: [{ description: gateDescription, code: gateCode }]
      }).save();
    }

    await PendingCode.deleteOne({ _id: pending._id });
    res.json({ ok: true });
  } catch (err) {
    debugLog('/approveCode error', err.message);
    res.json({ ok: false });
  }
});

app.post(APP_DIRECTORY + '/rejectCode', requireAuth, async function(req, res) {
  try {
    var id = String((req.body && req.body.id) || '').trim();
    if (!id) return res.json({ ok: false });
    await PendingCode.deleteOne({ _id: id });
    res.json({ ok: true });
  } catch (err) {
    debugLog('/rejectCode error', err.message);
    res.json({ ok: false });
  }
});

app.route(APP_DIRECTORY + '/validatePassword')
  .get(function(req, res) { res.json(false); })
  .post(authLimiter, function(req, res) { res.json(safeCompare(req.body.password, ADMINPASS)); });

app.route(APP_DIRECTORY + '/validateConsolePassword')
  .get(function(req, res) { res.json(false); })
  .post(authLimiter, function(req, res) { res.json(safeCompare(req.body.password, ADMINCONSOLE)); });

app.listen(process.env.PORT || 3000, function() {
  console.log('SmartStop running on port ' + (process.env.PORT || 3000));
});