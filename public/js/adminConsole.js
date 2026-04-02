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

// ── Shared helper: get card by user ID ───────────────
function getUserCard(userID) {
  return document.getElementById('uc-' + userID);
}

// ── Shared helper: prompt console password once ──────
function withConsolePassword(callback) {
  var password = prompt('Enter Console Password');
  if (!password) return;
  $.post(domain + '/validateConsolePassword', { password: password }, function(granted) {
    if (!granted) { consoleErr('Invalid console password.'); return; }
    callback();
  }).fail(function() { consoleErr('Network error.'); });
}

function verifyUser(btn) {
  var userID = btn.id;
  withConsolePassword(function() {
    $.post(domain + '/verifyUser', { userID: userID }, function(ok) {
      if (ok) {
        btn.outerHTML = '<button id="' + userID + '" onclick="restrictUser(this)" class="btn-toggle-verify verified" title="Revoke access"><i class="fas fa-user-slash"></i></button>';
        var card = getUserCard(userID);
        if (card) {
          var badge = card.querySelector('.badge-unverified');
          if (badge) { badge.className = 'badge-verified'; badge.textContent = 'Verified'; }
        }
        consoleMsg('User access granted.');
      } else { consoleErr('Unable to verify user.'); }
    }).fail(function() { consoleErr('Network error.'); });
  });
}

function restrictUser(btn) {
  var userID = btn.id;
  withConsolePassword(function() {
    $.post(domain + '/restrictUser', { userID: userID }, function(ok) {
      if (ok) {
        btn.outerHTML = '<button id="' + userID + '" onclick="verifyUser(this)" class="btn-toggle-verify unverified" title="Grant access"><i class="fas fa-user-check"></i></button>';
        var card = getUserCard(userID);
        if (card) {
          var badge = card.querySelector('.badge-verified');
          if (badge) { badge.className = 'badge-unverified'; badge.textContent = 'Pending'; }
        }
        consoleMsg('User access revoked.');
      } else { consoleErr('Unable to restrict user.'); }
    }).fail(function() { consoleErr('Network error.'); });
  });
}

function elevateUser(btn) {
  var userID = btn.id;
  withConsolePassword(function() {
    $.post(domain + '/elevateUser', { userID: userID }, function(ok) {
      if (ok) {
        btn.outerHTML = '<button id="' + userID + '" onclick="demoteUser(this)" class="btn-demote" title="Demote from admin"><i class="fas fa-arrow-down"></i></button>';
        var card = getUserCard(userID);
        if (card) {
          var badges = card.querySelector('.user-badges');
          if (badges && !badges.querySelector('.badge-role-admin')) {
            var adminBadge = document.createElement('span');
            adminBadge.className = 'badge-role-admin';
            adminBadge.textContent = 'Admin';
            badges.insertBefore(adminBadge, badges.firstChild);
          }
        }
        consoleMsg('User promoted to admin.');
      } else { consoleErr('Unable to promote user.'); }
    }).fail(function() { consoleErr('Network error.'); });
  });
}

function demoteUser(btn) {
  var userID = btn.id;
  withConsolePassword(function() {
    $.post(domain + '/demoteUser', { userID: userID }, function(ok) {
      if (ok) {
        btn.outerHTML = '<button id="' + userID + '" onclick="elevateUser(this)" class="btn-elevate" title="Promote to admin"><i class="fas fa-arrow-up"></i></button>';
        var card = getUserCard(userID);
        if (card) {
          var adminBadge = card.querySelector('.badge-role-admin');
          if (adminBadge) adminBadge.remove();
        }
        consoleMsg('User demoted from admin.');
      } else { consoleErr('Unable to demote user.'); }
    }).fail(function() { consoleErr('Network error.'); });
  });
}

function deleteUser(btn) {
  var userID = btn.id;
  if (!confirm('Permanently delete this user? This cannot be undone.')) return;
  withConsolePassword(function() {
    $.post(domain + '/deleteUser', { userID: userID }, function(ok) {
      if (ok) {
        var card = getUserCard(userID);
        if (card) {
          card.style.transition = 'opacity .3s';
          card.style.opacity = '0';
          setTimeout(function() { card.remove(); }, 320);
        }
        consoleMsg('User deleted.');
      } else { consoleErr('Unable to delete user.'); }
    }).fail(function() { consoleErr('Network error.'); });
  });
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

