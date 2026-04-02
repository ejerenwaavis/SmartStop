// ── AdminForm.js ─────────────────────────────────────
// Manages the add-community admin form: gate codes, street tags, discovery
// NOTE: `domain` is declared by locate.js which is loaded first via footerAdmin.ejs

var _adminLat = null;
var _adminLng = null;

$(document).ready(function () {
  var $err = $('#js-error-message');
  if ($err.length) setTimeout(function () { $err.addClass('d-none'); }, 4000);
  var $msg = $('.ss-alert-success');
  if ($msg.length) setTimeout(function () { $msg.fadeOut(600); }, 4000);

  // Eagerly grab GPS so autocomplete can bias to user's area
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      function(pos) { _adminLat = pos.coords.latitude; _adminLng = pos.coords.longitude; },
      function() { /* permission denied or unavailable — fall back to unbiased results */ },
      { timeout: 10000, maximumAge: 60000 }
    );
  }
});

// ── Street tag system ─────────────────────────────────
var addedStreets = [];

function renderStreetTags() {
  var container = $('#street-tags-container');
  var hidden    = $('#street-hidden-inputs');
  container.html('');
  hidden.html('');

  addedStreets.forEach(function (street, idx) {
    container.append(
      '<span class="street-tag">' + street +
      '<button type="button" class="street-tag-remove" onclick="removeStreet(' + idx + ')" aria-label="Remove">' +
      '<i class="fas fa-times"></i></button></span>'
    );
    hidden.append('<input type="hidden" class="street-address" value="' + street.replace(/"/g, '&quot;') + '">');
  });
}

function removeStreet(idx) {
  addedStreets.splice(idx, 1);
  renderStreetTags();
}

function addStreetManually(name) {
  name = (name || '').trim().split(',')[0].trim(); // drop any ", City" suffix
  if (!name) return false;
  if (addedStreets.includes(name)) {
    showJsError('Already added: ' + name);
    return false;
  }
  addedStreets.push(name);
  renderStreetTags();
  return true;
}

// ── Add street from the input field ──────────────────
function addCurrentStreet() {
  var val = $('#discover-street-input').val().trim();
  if (!val) { showJsError('Enter a street name first.'); return; }
  if (addStreetManually(val)) {
    $('#discover-street-input').val('').focus();
    closeStreetAc();
  }
}

// ── Street autocomplete ───────────────────────────────
var acTimer = null;

function streetInputChange(input) {
  var q = (input.value || '').trim();
  clearTimeout(acTimer);
  if (q.split(',')[0].trim().length < 2) { closeStreetAc(); return; }
  acTimer = setTimeout(function () { fetchStreetSuggestions(q); }, 150);
}

function streetInputKeyDown(e) {
  var dropdown  = document.getElementById('street-ac-dropdown');
  var items     = dropdown ? Array.prototype.slice.call(dropdown.querySelectorAll('.street-ac-item')) : [];
  var activeIdx = items.findIndex(function (el) { return el.classList.contains('ac-active'); });

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (activeIdx >= 0) items[activeIdx].classList.remove('ac-active');
    var next = activeIdx < items.length - 1 ? activeIdx + 1 : 0;
    if (items[next]) items[next].classList.add('ac-active');
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (activeIdx >= 0) items[activeIdx].classList.remove('ac-active');
    var prev = activeIdx > 0 ? activeIdx - 1 : items.length - 1;
    if (items[prev]) items[prev].classList.add('ac-active');
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (activeIdx >= 0 && items[activeIdx]) {
      var d = items[activeIdx].dataset;
      selectStreetSuggestion(d.street, d.city, d.state);
    } else {
      addCurrentStreet();
    }
  } else if (e.key === 'Escape') {
    closeStreetAc();
  }
}

function _googlePlaceSuggest(q, geoOptions, callback) {
  if (!window.google || !google.maps || !google.maps.places) { callback([]); return; }
  var svc = new google.maps.places.AutocompleteService();
  var opts = {
    input: q,
    types: ['geocode'],
    componentRestrictions: { country: 'us' }
  };
  if (geoOptions && geoOptions.lat && geoOptions.lng) {
    opts.location = new google.maps.LatLng(geoOptions.lat, geoOptions.lng);
    opts.radius = 80000; // 80 km bias — heavily prefers nearby streets
    opts.strictBounds = false;
  }
  svc.getPlacePredictions(opts, function(preds, status) {
    if (status !== google.maps.places.PlacesServiceStatus.OK || !preds) { callback([]); return; }
    callback(preds.slice(0, 6).map(function(p) {
      var terms = p.terms || [];
      return {
        street: terms[0] ? terms[0].value : (p.description.split(',')[0] || '').trim(),
        city:   terms[1] ? terms[1].value : '',
        state:  terms[2] ? terms[2].value : ''
      };
    }));
  });
}

function fetchStreetSuggestions(q) {
  var streetPart = q.split(',')[0].trim();
  var city = $('#city').val().trim();
  var url  = domain + '/streetSuggest?q=' + encodeURIComponent(streetPart) + (city ? '&city=' + encodeURIComponent(city) : '');
  $.getJSON(url, function (localResults) {
    var allResults = (localResults || []).slice();

    function renderDropdown(results) {
      var $drop = $('#street-ac-dropdown');
      $drop.html('').addClass('d-none');
      if (!results || !results.length) return;
      results.forEach(function (r) {
        var label = r.street + (r.city ? ', ' + r.city : '') + (r.state ? ', ' + r.state : '');
        $('<div class="street-ac-item"></div>')
          .text(label)
          .attr({ 'data-street': r.street, 'data-city': r.city || '', 'data-state': r.state || '' })
          .on('mousedown', function (e) {
            e.preventDefault();
            selectStreetSuggestion(r.street, r.city, r.state);
          })
          .appendTo($drop);
      });
      $drop.removeClass('d-none');
    }

    if (allResults.length >= 6) { renderDropdown(allResults.slice(0, 6)); return; }

    _googlePlaceSuggest(streetPart, { lat: _adminLat, lng: _adminLng }, function(googleResults) {
      var seen = {};
      allResults.forEach(function(r) { seen[(r.street || '').toLowerCase()] = true; });
      (googleResults || []).forEach(function(g) {
        if (!seen[(g.street || '').toLowerCase()]) { allResults.push(g); seen[(g.street || '').toLowerCase()] = true; }
      });
      renderDropdown(allResults.slice(0, 6));
    });
  }).fail(function () { closeStreetAc(); });
}

function selectStreetSuggestion(street, city, state) {
  if (city  && !$('#city').val().trim())      $('#city').val(city);
  if (state && !$('#stateCode').val().trim()) $('#stateCode').val(state);
  closeStreetAc();
  if (addStreetManually(street)) {
    $('#discover-street-input').val('').focus();
  } else {
    $('#discover-street-input').val(street);
  }
}

function closeStreetAc() {
  $('#street-ac-dropdown').addClass('d-none').html('');
}

$(document).on('click', function (e) {
  if (!$(e.target).closest('#street-ac-wrapper').length) closeStreetAc();
});

// ── Discover streets via Overpass ─────────────────────
function discoverStreets() {
  var streetName = $('#discover-street-input').val().trim();
  var city       = $('#city').val().trim();
  var state      = $('#stateCode').val().trim();

  if (!streetName) {
    showJsError('Enter a street name before discovering.');
    return;
  }
  if (!city) {
    showJsError('Enter the city name first.');
    return;
  }

  var btn = $('#discover-btn');
  btn.prop('disabled', true).html('<span class="discover-spinner"></span> Searching&hellip;');
  $('#discovery-results').addClass('d-none');

  $.post(domain + '/discoverStreets', { streetName: streetName, city: city, state: state }, function (data) {
    btn.prop('disabled', false).html('<i class="fas fa-magic"></i> Discover');

    if (data.streets && data.streets.length > 0) {
      if (data.city  && !$('#city').val().trim())      $('#city').val(data.city);
      if (data.state && !$('#stateCode').val().trim()) $('#stateCode').val(data.state);

      var items = $('#discovery-items');
      items.html('');
      data.streets.forEach(function (street) {
        var alreadyAdded = addedStreets.includes(street);
        items.append(
          '<label class="discovery-item">' +
          '<input type="checkbox" ' + (alreadyAdded ? 'checked disabled' : 'checked') + ' value="' + street.replace(/"/g, '&quot;') + '">' +
          street + (alreadyAdded ? ' <em style="font-size:.7rem;color:var(--clr-muted)">(added)</em>' : '') +
          '</label>'
        );
      });
      $('#discovery-results').removeClass('d-none');
    } else {
      showJsError('No streets found nearby. Try a different street name or check the city/state.');
    }
  }).fail(function () {
    btn.prop('disabled', false).html('<i class="fas fa-magic"></i> Discover');
    showJsError('Network error during discovery. Please try again.');
  });
}

function addDiscoveredStreets() {
  var added = 0;
  $('#discovery-items input[type=checkbox]:checked:not(:disabled)').each(function () {
    var street = $(this).val();
    if (!addedStreets.includes(street)) {
      addedStreets.push(street);
      added++;
    }
  });
  renderStreetTags();
  $('#discovery-results').addClass('d-none');
  if (added > 0) {
    showJsMessage(added + ' street' + (added === 1 ? '' : 's') + ' added.');
  }
}

// ── Gate Code fields ──────────────────────────────────
function GateCode(description, code) {
  this.description = description;
  this.code = code;
}

function addGateCodeField() {
  var codes = getGateCodesData();
  var html  = '';
  codes.forEach(function (gc) {
    html += buildGateCodeFieldHtml(gc.description, gc.code);
  });
  html += buildGateCodeFieldHtml('', '');
  $('#gate-code-container').html(html);
}

function buildGateCodeFieldHtml(desc, code) {
  return '<div class="field-pair">' +
    '<input type="text" class="form-control gate-code-description" placeholder="Description (e.g. Main Gate)" value="' + desc.replace(/"/g, '&quot;') + '">' +
    '<input type="text" class="form-control gate-code" placeholder="Code" value="' + code.replace(/"/g, '&quot;') + '" style="max-width:110px">' +
    '</div>';
}

function getGateCodesData() {
  var codes = [];
  var descs = $('.gate-code-description');
  var vals  = $('.gate-code');
  for (var i = 0; i < descs.length; i++) {
    var d = descs[i].value.trim();
    var c = vals[i].value.trim();
    if (d && c) codes.push(new GateCode(d, c));
  }
  return codes;
}

// ── Form submission ───────────────────────────────────
function sendForm() {
  var gateCodes = getGateCodesData();
  var streets   = addedStreets.slice();

  // Also pick up any hidden street inputs rendered by renderStreetTags
  if (streets.length === 0) {
    $('.street-address').each(function () {
      var v = $(this).val().trim();
      if (v && !streets.includes(v)) streets.push(v);
    });
  }

  var communityName = $('#communityName').val().trim();

  if (communityName.length < 2) {
    showJsError('Community name must be at least 2 characters.');
    return;
  }
  if (streets.length === 0) {
    showJsError('Add at least one street.');
    return;
  }
  if (gateCodes.length === 0) {
    showJsError('Add at least one gate code.');
    return;
  }

  $('#gate-code-JSON').val(JSON.stringify(gateCodes));
  $('#streets-JSON').val(JSON.stringify(streets));
  $('#add-community-form').submit();
}

// ── Utility ───────────────────────────────────────────
function showJsError(msg) {
  $('#js-error-message').text(msg).removeClass('d-none');
  setTimeout(function () { $('#js-error-message').addClass('d-none'); }, 5000);
}

function showJsMessage(msg) {
  var $m = $('#js-message');
  if (!$m.length) return;
  $m.text(msg).removeClass('d-none');
  setTimeout(function () { $m.addClass('d-none'); }, 3000);
}