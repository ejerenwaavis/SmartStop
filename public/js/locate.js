
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
  const x = position.coords.latitude;
  const y = position.coords.longitude;
  sessionStorage.setItem(autoLocateKey, '1');
  $('#coord-x').text('Lat: ' + x);
  $('#coord-y').text('Lon: ' + y);
  $('#position').val(x + ',' + y);
  $('#location-form').submit();
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

runAutoLocateOnce();

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
