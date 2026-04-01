
const domain = $('#domain').attr('domain');

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
});

// ── Geolocation ──────────────────────────────────────
const hasLocateError = $('.ss-alert-danger').length > 0;
const autoLocateKey = 'smartstop:auto-locate-ran';

const getGeocode = new Promise(function (resolve, reject) {
  if (!navigator.geolocation) {
    return reject(new Error('Geolocation not supported'));
  }
  navigator.geolocation.getCurrentPosition(resolve, reject, {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0
  });
});

const getCurrentStreetName = new Promise(function (resolve, reject) {
  getGeocode
    .then(function (position) {
      const coords = position.coords.latitude + ',' + position.coords.longitude;
      $.post(domain + '/resourceStreet', { position: coords }, function (result) {
        resolve(result || '');
      }).fail(function () { resolve(''); });
    })
    .catch(function (err) { reject(err); });
});

function onGeoSuccess(position) {
  var lat = position.coords.latitude;
  var lon = position.coords.longitude;
  sessionStorage.setItem(autoLocateKey, '1');

  $.get(domain + '/locateJSON', { lat: lat, lon: lon }, function(data) {
    $('#locating-state').hide();
    renderLocateResult(data);
  }).fail(function() {
    $('#locating-state').hide();
    $('#gpsError').text('Location lookup failed. Search manually above.');
  });
}

function onGeoError(err) {
  sessionStorage.setItem(autoLocateKey, '1');
  $('#locating-state').hide();
  var msg = 'Location access is off. Turn it on and refresh, or search manually above.';
  if (err && err.code === 1) {
    msg = 'Location access denied. Search a community manually above.';
  }
  $('#gpsError').text(msg);
}

function runAutoLocateOnce() {
  var alreadyRan = sessionStorage.getItem(autoLocateKey) === '1';
  if (hasLocateError || alreadyRan) {
    $('#locating-state').hide();
    if (hasLocateError) {
      $('#gpsError').text('Automatic location lookup failed. Search manually above.');
    }
    return;
  }
  getGeocode.then(onGeoSuccess).catch(onGeoError);
}

function reLocate() {
  sessionStorage.removeItem(autoLocateKey);
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
      var desc = document.getElementById('suggest-description');
      if (desc) desc.focus();
    }, 50);
  } else {
    form.classList.add('d-none');
  }
}

function submitSuggestedCode() {
  var street = ($('#suggest-street').val() || '').trim();
  var city   = ($('#suggest-city').val() || '').trim();
  var state  = ($('#suggest-state').val() || '').trim();
  var postal = ($('#suggest-postal').val() || '').trim();
  var desc   = ($('#suggest-description').val() || '').trim();
  var code   = ($('#suggest-code-input').val() || '').trim();
  var $err   = $('#suggest-error');
  var $ok    = $('#suggest-success');
  $err.addClass('d-none');
  $ok.addClass('d-none');

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
