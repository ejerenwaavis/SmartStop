const domain = $('#domain').attr('domain');

$(document).ready(function(){
  $("#error-message").fadeOut(3500);
});

function reload() {
  location.reload();
}

function consoleMsg(msg) {
  $('#js-message').text(msg).removeClass('d-none');
  setTimeout(function () { $('#js-message').addClass('d-none'); }, 3500);
}

function consoleErr(msg) {
  $('#js-error-message').text(msg).removeClass('d-none');
  setTimeout(function () { $('#js-error-message').addClass('d-none'); }, 4000);
}

function verifyUser(btn) {
  var password = prompt('Enter Console Password');
  if (!password) return;
  var userID = btn.id;
  $.post(domain + '/validateConsolePassword', { password: password }, function (granted) {
    if (!granted) { consoleErr('Invalid console password.'); return; }
    $.post(domain + '/verifyUser', { userID: userID }, function (ok) {
      if (ok) {
        // Update button in place — fix the hardcoded ID bug from original
        btn.outerHTML =
          '<button id="' + userID + '" onclick="restrictUser(this)" class="btn-toggle-verify verified">' +
          '<i class="fas fa-user-check me-1"></i> Restrict</button>';
        // Update badge next to the button
        var card = document.getElementById(userID) ? document.getElementById(userID).closest('.user-card') : null;
        if (card) {
          var badge = card.querySelector('.badge-unverified');
          if (badge) { badge.className = 'badge-verified me-2'; badge.textContent = 'Verified'; }
        }
        consoleMsg('User verified successfully.');
      } else {
        consoleErr('Unable to verify user.');
      }
    }).fail(function () { consoleErr('Network error.'); });
  }).fail(function () { consoleErr('Network error.'); });
}

function restrictUser(btn) {
  var password = prompt('Enter Console Password');
  if (!password) return;
  var userID = btn.id;
  $.post(domain + '/validateConsolePassword', { password: password }, function (granted) {
    if (!granted) { consoleErr('Invalid console password.'); return; }
    $.post(domain + '/restrictUser', { userID: userID }, function (ok) {
      if (ok) {
        btn.outerHTML =
          '<button id="' + userID + '" onclick="verifyUser(this)" class="btn-toggle-verify unverified">' +
          '<i class="fas fa-user-times me-1"></i> Verify</button>';
        var card = document.getElementById(userID) ? document.getElementById(userID).closest('.user-card') : null;
        if (card) {
          var badge = card.querySelector('.badge-verified');
          if (badge) { badge.className = 'badge-unverified me-2'; badge.textContent = 'Pending'; }
        }
        consoleMsg('User restricted.');
      } else {
        consoleErr('Unable to restrict user.');
      }
    }).fail(function () { consoleErr('Network error.'); });
  }).fail(function () { consoleErr('Network error.'); });
}

function approveCode(id) {
  var password = prompt('Enter Console Password');
  if (!password) return;
  $.post(domain + '/validateConsolePassword', { password: password }, function (granted) {
    if (!granted) { consoleErr('Invalid console password.'); return; }
    $.post(domain + '/approveCode', { id: id }, function (data) {
      if (data && data.ok) {
        var card = document.getElementById('pc-' + id);
        if (card) card.remove();
        consoleMsg('Code approved and added to the community.');
      } else {
        consoleErr('Failed to approve code.');
      }
    }).fail(function () { consoleErr('Network error.'); });
  }).fail(function () { consoleErr('Network error.'); });
}

function rejectCode(id) {
  var password = prompt('Enter Console Password');
  if (!password) return;
  $.post(domain + '/validateConsolePassword', { password: password }, function (granted) {
    if (!granted) { consoleErr('Invalid console password.'); return; }
    $.post(domain + '/rejectCode', { id: id }, function (data) {
      if (data && data.ok) {
        var card = document.getElementById('pc-' + id);
        if (card) card.remove();
        consoleMsg('Submission rejected and removed.');
      } else {
        consoleErr('Failed to reject submission.');
      }
    }).fail(function () { consoleErr('Network error.'); });
  }).fail(function () { consoleErr('Network error.'); });
}

