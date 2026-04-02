
const domain = $('#domain').attr('domain');

var _userLat = null;
var _userLng = null;

$(document).ready(function () {
  // Show admin include section only when location payload is present
  var payload = ($('#locationJSONString').val() || $('#geoCodeForm textarea[name="locationJSONString"]').val() || '').trim();
  if ($('#adminInclude').length && payload) {
    $('#adminInclude').removeClass('d-none');
  }

  // Admin include form submission via modal
  $('#accessForm').on('submit', function (e) {
    e.preventDefault();
    includeCommunity();
  });

  runAutoLocateOnce();
});

// ── Geolocation ──────────────────────────────────────

function onGeoSuccess(position) {
  var lat = position.coords.latitude;
  var lon = position.coords.longitude;
  _userLat = lat;
  _userLng = lon;

  $.ajax({
    url: domain + '/locateJSON',
    type: 'GET',
    dataType: 'json',
    data: { lat: lat, lon: lon },
    success: function(data) {
      $('#locating-state').hide();
      renderLocateResult(data);
    },
    error: function() {
      $('#locating-state').hide();
      $('#gpsError').text('Location lookup failed. Search manually above.');
    }
  });
}

function onGeoError(err) {
  $('#locating-state').hide();
  var msg = 'Location access is off. Turn it on and refresh, or search manually above.';
  if (err && err.code === 1) {
    msg = 'Location access denied. Search a community manually above.';
  }
  $('#gpsError').text(msg);
}

function runAutoLocateOnce() {
  if (!navigator.geolocation) {
    $('#locating-state').hide();
    $('#gpsError').text('Your browser does not support geolocation. Search manually above.');
    return;
  }
  navigator.geolocation.getCurrentPosition(onGeoSuccess, onGeoError, {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0
  });
}

function reLocate() {
  $('#communityDescription').html('');
  $('#searchedCode').html('');
  $('#locate-relocate').addClass('d-none');
  $('#gpsError').text('');
  $('#locating-state').show();
  navigator.geolocation.getCurrentPosition(onGeoSuccess, onGeoError, {
    enableHighAccuracy: true, timeout: 10000, maximumAge: 0
  });
}

// ── HTML escaping helper ──────────────────────────────
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

// ── Render locate results inline ─────────────────────
function renderLocateResult(data) {
  if (data.error) {
    $('#gpsError').text(data.error);
    return;
  }
  var loc = data.location;

  // Populate admin include form with location JSON
  $('#locationJSONString').val(JSON.stringify(loc));

  // Community card
  var displayName = data.found ? esc(data.community.communityName) + ' Community' : esc(loc.street);
  var streets     = data.found ? data.community.streets : [loc.street];
  var streetBadges = streets.map(function(s) {
    return '<span class="street-badge"><i class="fas fa-road me-1"></i>' + esc(s) + '</span>';
  }).join('');
  var cityLine = loc.city
    ? '<p class="mt-2 mb-0" style="font-size:.78rem;color:var(--clr-muted)"><i class="fas fa-city me-1"></i>' +
      esc(loc.city) + (loc.stateCode ? ', ' + esc(loc.stateCode) : '') + '</p>'
    : '';

  $('#communityDescription').html(
    '<div class="community-card">' +
    '<p class="community-name"><i class="fas fa-map-marker-alt me-1" style="color:var(--clr-accent)"></i>' + displayName + '</p>' +
    '<div class="streets-row">' + streetBadges + '</div>' +
    cityLine + '</div>'
  );

  // Gate codes or no-codes state
  var codeHtml = '';
  if (data.found && data.community.gateCodes && data.community.gateCodes.length) {
    codeHtml += '<p class="gate-codes-section-label"><i class="fas fa-key me-1"></i> Gate Codes</p>';
    data.community.gateCodes.forEach(function(gc) {
      var codeStr = String(gc.code || '');
      var prefix  = (codeStr.length === 4 && codeStr !== '0000') ? '#' : '';
      codeHtml += '<div class="gate-code-card">' +
        '<p class="gate-code-label">' + esc(gc.description || 'Gate Code') + '</p>' +
        '<p class="gate-code-number">' + prefix + esc(codeStr) + '</p>' + '</div>';
    });
  } else if (data.found) {
    codeHtml = '<div class="gate-code-card" style="color:var(--clr-muted);text-align:center;padding:2rem">' +
      '<i class="fas fa-key fa-2x mb-2 d-block" style="opacity:.3"></i>' +
      '<p class="mb-0" style="font-size:.875rem">No gate codes on record for this community</p></div>';
  } else {
    codeHtml = buildNoCodesHtml(loc);
  }

  $('#searchedCode').html(codeHtml);
  $('#locate-relocate').removeClass('d-none');
}

function buildNoCodesHtml(loc) {
  return '<div class="no-codes-card">' +
    '<div class="no-codes-icon-wrap"><i class="fas fa-key"></i></div>' +
    '<p class="no-codes-street">Street detected, no codes on file</p>' +
    '<p class="no-codes-label">Be the first to submit a code for <strong>' + esc(loc.street) + '</strong></p>' +
    '<button type="button" class="btn-suggest-code" onclick="toggleSuggestForm()">' +
    '<i class="fas fa-plus me-1"></i> Suggest a Code</button></div>' +
    '<div id="suggest-form" class="suggest-form d-none">' +
    '<p class="suggest-form-title"><i class="fas fa-key me-1"></i> Submit a Code for Review</p>' +
    '<p class="suggest-form-hint">Codes are reviewed by an admin before going live.</p>' +
    '<div class="street-ac-wrapper mb-2" id="suggest-ac-wrapper">' +
    '<input type="text" id="suggest-street-input" class="form-control" placeholder="Street (edit or search)" value="' + esc(loc.street) + '" autocomplete="off" onfocus="suggestStreetInputChange(this)" oninput="suggestStreetInputChange(this)" onkeydown="suggestStreetKeyDown(event)">' +
    '<div class="street-ac-dropdown d-none" id="suggest-street-dropdown"></div>' +
    '</div>' +
    '<input type="hidden" id="suggest-street" value="' + esc(loc.street) + '">' +
    '<input type="hidden" id="suggest-city" value="' + esc(loc.city || '') + '">' +
    '<input type="hidden" id="suggest-state" value="' + esc(loc.stateCode || '') + '">' +
    '<input type="hidden" id="suggest-postal" value="' + esc(loc.postalCode || '') + '">' +
    '<div class="d-flex gap-2 mb-2">' +
    '<input type="text" id="suggest-description" class="form-control" placeholder="Description (e.g. Main Gate)">' +
    '<input type="text" id="suggest-code-input" class="form-control" placeholder="Code" style="max-width:130px">' +
    '</div>' +
    '<button type="button" class="btn-primary-block" id="suggest-submit-btn" onclick="submitSuggestedCode()">' +
    '<i class="fas fa-paper-plane me-1"></i> Submit for Review</button>' +
    '<p class="d-none ss-alert ss-alert-danger mt-2" id="suggest-error"></p>' +
    '<p class="d-none ss-alert ss-alert-success mt-2" id="suggest-success"></p></div>' +
    '<div class="unregistered-banner mt-2">' +
    '<p class="unregistered-title"><i class="fas fa-tools me-1"></i> Admin: Register This Address</p>' +
    '<p class="unregistered-text">Formally add this street with a community name and full details.</p>' +
    '<button type="button" class="btn-accent" onclick="focusOnAdminPass()" data-bs-toggle="modal" data-bs-target="#adminPassModal">' +
    '<i class="fas fa-plus"></i> Include Community</button></div>';
}

// ── Admin Include (password modal) ───────────────────
function includeCommunity() {
  var payload = ($('#locationJSONString').val() || $('#geoCodeForm textarea[name="locationJSONString"]').val() || '').trim();
  if (!payload) {
    $('#error-message').text('No location data found. Please use Re-locate first.').show();
    return;
  }

  var adminPass = $('#adminPass').val().trim();
  if (!adminPass) {
    $('#error-message').text('Password cannot be empty').show();
    return;
  }
  $.post(domain + '/validatePassword', { password: adminPass }, function (granted) {
    if (granted === true) {
      $('#geoCodeForm').submit();
    } else {
      $('#error-message').text('Access Denied – Invalid Password').show();
      $('#adminPass').val('').focus();
    }
  }).fail(function () {
    $('#error-message').text('Network error. Please try again.').show();
  });
}

function submitGeoCodeForm() {
  var payload = ($('#locationJSONString').val() || $('#geoCodeForm textarea[name="locationJSONString"]').val() || '').trim();
  if (!payload) {
    if ($('#error-message').length) {
      $('#error-message').text('No location data found. Please use Re-locate first.').show();
    }
    return;
  }
  $('#geoCodeForm').submit();
}

function focusOnAdminPass() {
  var modal = document.getElementById('adminPassModal');
  if (modal) {
    modal.addEventListener('shown.bs.modal', function handler() {
      document.getElementById('adminPass').focus();
      modal.removeEventListener('shown.bs.modal', handler);
    });
  }
}

// ── User code suggestion (unregistered community) ────
function toggleSuggestForm() {
  var form = document.getElementById('suggest-form');
  if (!form) return;
  if (form.classList.contains('d-none')) {
    form.classList.remove('d-none');
    setTimeout(function () {
      var streetInput = document.getElementById('suggest-street-input');
      if (streetInput) {
        streetInput.focus();
        streetInput.select();
        return;
      }
      var desc = document.getElementById('suggest-description');
      if (desc) desc.focus();
    }, 50);
  } else {
    form.classList.add('d-none');
    closeSuggestStreetAc();
  }
}

var suggestAcTimer = null;

function suggestStreetInputChange(input) {
  var q = (input.value || '').trim();
  clearTimeout(suggestAcTimer);
  if (q.split(',')[0].trim().length < 2) {
    closeSuggestStreetAc();
    return;
  }
  suggestAcTimer = setTimeout(function() {
    fetchSuggestStreetSuggestions(q);
  }, 180);
}

function suggestStreetKeyDown(e) {
  var dropdown = document.getElementById('suggest-street-dropdown');
  var items = dropdown ? Array.prototype.slice.call(dropdown.querySelectorAll('.street-ac-item')) : [];
  var activeIdx = items.findIndex(function(el) { return el.classList.contains('ac-active'); });

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
    if (activeIdx >= 0 && items[activeIdx]) {
      e.preventDefault();
      var d = items[activeIdx].dataset;
      selectSuggestStreetSuggestion(d.street, d.city, d.state);
    }
  } else if (e.key === 'Escape') {
    closeSuggestStreetAc();
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

function fetchSuggestStreetSuggestions(q) {
  var streetPart = q.split(',')[0].trim();
  var city = ($('#suggest-city').val() || '').trim();
  var url = domain + '/streetSuggest?q=' + encodeURIComponent(streetPart) + (city ? '&city=' + encodeURIComponent(city) : '');

  $.getJSON(url, function(localResults) {
    var allResults = (localResults || []).slice();

    function renderDropdown(results) {
      var $drop = $('#suggest-street-dropdown');
      $drop.html('').addClass('d-none');
      if (!results || !results.length) return;
      results.forEach(function(r) {
        var label = r.street + (r.city ? ', ' + r.city : '') + (r.state ? ', ' + r.state : '');
        $('<div class="street-ac-item"></div>')
          .text(label)
          .attr({ 'data-street': r.street || '', 'data-city': r.city || '', 'data-state': r.state || '' })
          .on('mousedown', function(evt) {
            evt.preventDefault();
            selectSuggestStreetSuggestion(r.street, r.city, r.state);
          })
          .appendTo($drop);
      });
      $drop.removeClass('d-none');
    }

    if (allResults.length >= 6) { renderDropdown(allResults.slice(0, 6)); return; }

    _googlePlaceSuggest(streetPart, { lat: _userLat, lng: _userLng }, function(googleResults) {
      var seen = {};
      allResults.forEach(function(r) { seen[(r.street || '').toLowerCase()] = true; });
      (googleResults || []).forEach(function(g) {
        if (!seen[(g.street || '').toLowerCase()]) { allResults.push(g); seen[(g.street || '').toLowerCase()] = true; }
      });
      renderDropdown(allResults.slice(0, 6));
    });
  }).fail(function() {
    closeSuggestStreetAc();
  });
}

function selectSuggestStreetSuggestion(street, city, state) {
  var cleanStreet = String(street || '').trim();
  $('#suggest-street-input').val(cleanStreet);
  $('#suggest-street').val(cleanStreet);
  if (city) $('#suggest-city').val(city);
  if (state) $('#suggest-state').val(state);
  closeSuggestStreetAc();
}

function closeSuggestStreetAc() {
  $('#suggest-street-dropdown').addClass('d-none').html('');
}

$(document).on('click', function(e) {
  if (!$(e.target).closest('#suggest-ac-wrapper').length) closeSuggestStreetAc();
});

function submitSuggestedCode() {
  var streetInput = ($('#suggest-street-input').val() || '').trim();
  var street = (streetInput ? streetInput.split(',')[0].trim() : ($('#suggest-street').val() || '').trim());
  $('#suggest-street').val(street);
  var city   = ($('#suggest-city').val() || '').trim();
  var state  = ($('#suggest-state').val() || '').trim();
  var postal = ($('#suggest-postal').val() || '').trim();
  var desc   = ($('#suggest-description').val() || '').trim();
  var code   = ($('#suggest-code-input').val() || '').trim();
  var $err   = $('#suggest-error');
  var $ok    = $('#suggest-success');
  $err.addClass('d-none');
  $ok.addClass('d-none');

  if (!street) { $err.text('Please enter the street name').removeClass('d-none'); return; }
  if (!desc) { $err.text('Please enter a description (e.g. Main Gate)').removeClass('d-none'); return; }
  if (!code) { $err.text('Please enter the gate code').removeClass('d-none'); return; }

  var $btn = $('#suggest-submit-btn');
  $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-1"></i> Submitting\u2026');

  $.post(domain + '/suggestCode',
    { street: street, city: city, stateCode: state, postalCode: postal, description: desc, code: code },
    function (result) {
      $btn.prop('disabled', false).html('<i class="fas fa-paper-plane me-1"></i> Submit for Review');
      if (result && result.ok) {
        $ok.text('Code submitted! An admin will review it before it goes live.').removeClass('d-none');
        $('#suggest-description').val('');
        $('#suggest-code-input').val('');
      } else {
        $err.text('Submission failed. Please try again.').removeClass('d-none');
      }
    }
  ).fail(function () {
    $btn.prop('disabled', false).html('<i class="fas fa-paper-plane me-1"></i> Submit for Review');
    $err.text('Network error. Please try again.').removeClass('d-none');
  });
}
