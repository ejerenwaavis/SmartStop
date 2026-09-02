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

function updatePendingBadgeCount(delta) {
  var badge = document.querySelector('#tab-btn-pending .tab-badge');
  if (badge) {
    var current = parseInt(badge.textContent, 10) || 0;
    var updated = current + delta;
    if (updated > 0) {
      badge.textContent = updated;
    } else {
      badge.remove();
    }
  }
}

function checkEmptyPending() {
  var cards = document.querySelectorAll('.pending-code-card');
  if (cards.length === 0) {
    var bar = document.getElementById('bulk-action-bar');
    if (bar) bar.style.display = 'none';
    var filterBar = document.querySelector('.pending-filter-bar');
    if (filterBar) filterBar.style.display = 'none';
    var emptyBanner = document.getElementById('empty-pending-banner');
    if (emptyBanner) emptyBanner.style.display = '';
  }
}

function approveCode(id) {
  withConsolePassword(function() {
    $.post(domain + '/approveCode', { id: id }, function (data) {
      if (data && data.ok) {
        var card = document.getElementById('pc-' + id);
        if (card) card.remove();
        updatePendingBadgeCount(-1);
        updateBulkBar();
        checkEmptyPending();
        consoleMsg('Code approved and added to the community.');
      } else {
        consoleErr('Failed to approve code.');
      }
    }).fail(function () { consoleErr('Network error.'); });
  });
}

function rejectCode(id) {
  withConsolePassword(function() {
    $.post(domain + '/rejectCode', { id: id }, function (data) {
      if (data && data.ok) {
        var card = document.getElementById('pc-' + id);
        if (card) card.remove();
        updatePendingBadgeCount(-1);
        updateBulkBar();
        checkEmptyPending();
        consoleMsg('Submission rejected and removed.');
      } else {
        consoleErr('Failed to reject submission.');
      }
    }).fail(function () { consoleErr('Network error.'); });
  });
}

// ── Bulk & Filter Functions ─────────────────────────
function getSelectedPendingIds() {
  var checked = document.querySelectorAll('.pending-card-checkbox:checked');
  var ids = [];
  checked.forEach(function(cb) {
    var card = cb.closest('.pending-code-card');
    if (card && card.style.display !== 'none') {
      ids.push(cb.value);
    }
  });
  return ids;
}

function updateBulkBar() {
  var selected = getSelectedPendingIds();
  var count = selected.length;
  var counter = document.getElementById('selected-counter');
  if (counter) counter.textContent = count + ' selected';

  var btnApprove = document.getElementById('btn-bulk-approve');
  var btnReject = document.getElementById('btn-bulk-reject');
  if (btnApprove) btnApprove.disabled = count === 0;
  if (btnReject) btnReject.disabled = count === 0;

  var visibleCheckboxes = Array.from(document.querySelectorAll('.pending-code-card'))
    .filter(function(card) { return card.style.display !== 'none'; })
    .map(function(card) { return card.querySelector('.pending-card-checkbox'); })
    .filter(Boolean);

  var selectAll = document.getElementById('select-all-pending');
  if (selectAll) {
    if (visibleCheckboxes.length > 0 && visibleCheckboxes.every(function(cb) { return cb.checked; })) {
      selectAll.checked = true;
      selectAll.indeterminate = false;
    } else if (visibleCheckboxes.some(function(cb) { return cb.checked; })) {
      selectAll.checked = false;
      selectAll.indeterminate = true;
    } else {
      selectAll.checked = false;
      selectAll.indeterminate = false;
    }
  }
}

function onCardCheckboxChange() {
  updateBulkBar();
}

function toggleSelectAllPending(isChecked) {
  var cards = document.querySelectorAll('.pending-code-card');
  cards.forEach(function(card) {
    if (card.style.display !== 'none') {
      var cb = card.querySelector('.pending-card-checkbox');
      if (cb) cb.checked = isChecked;
    }
  });
  updateBulkBar();
}

function filterPendingCodes() {
  var selEl = document.getElementById('filter-submitter');
  var searchEl = document.getElementById('pending-search');
  var selectedSubmitter = selEl ? (selEl.value || '').toLowerCase().trim() : '';
  var searchQuery = searchEl ? (searchEl.value || '').toLowerCase().trim() : '';

  var cards = document.querySelectorAll('.pending-code-card');
  var visibleCount = 0;

  cards.forEach(function(card) {
    var sub = (card.getAttribute('data-submitter') || '').toLowerCase().trim();
    var search = (card.getAttribute('data-search') || '').toLowerCase();

    var matchSubmitter = !selectedSubmitter || sub === selectedSubmitter;
    var matchSearch = !searchQuery || search.indexOf(searchQuery) !== -1;

    if (matchSubmitter && matchSearch) {
      card.style.display = '';
      visibleCount++;
    } else {
      card.style.display = 'none';
      var cb = card.querySelector('.pending-card-checkbox');
      if (cb) cb.checked = false;
    }
  });

  var noResults = document.getElementById('no-filter-results');
  if (noResults) {
    noResults.classList.toggle('d-none', visibleCount > 0 || cards.length === 0);
  }

  updateBulkBar();
}

function bulkApproveCodes() {
  var ids = getSelectedPendingIds();
  if (ids.length === 0) return;

  if (!confirm('Approve and activate ' + ids.length + ' selected gate code(s)?')) return;

  withConsolePassword(function() {
    $.ajax({
      url: domain + '/bulkApproveCodes',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ ids: ids }),
      success: function(data) {
        if (data && data.ok) {
          ids.forEach(function(id) {
            var card = document.getElementById('pc-' + id);
            if (card) card.remove();
          });
          updatePendingBadgeCount(-ids.length);
          updateBulkBar();
          consoleMsg(data.count + ' code(s) approved and added to communities.');
          checkEmptyPending();
        } else {
          consoleErr('Failed to approve selected codes.');
        }
      },
      error: function() {
        consoleErr('Network error.');
      }
    });
  });
}

function bulkRejectCodes() {
  var ids = getSelectedPendingIds();
  if (ids.length === 0) return;

  if (!confirm('Reject and permanently delete ' + ids.length + ' selected submission(s)?')) return;

  withConsolePassword(function() {
    $.ajax({
      url: domain + '/bulkRejectCodes',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ ids: ids }),
      success: function(data) {
        if (data && data.ok) {
          ids.forEach(function(id) {
            var card = document.getElementById('pc-' + id);
            if (card) card.remove();
          });
          updatePendingBadgeCount(-ids.length);
          updateBulkBar();
          consoleMsg(data.count + ' submission(s) rejected.');
          checkEmptyPending();
        } else {
          consoleErr('Failed to reject selected codes.');
        }
      },
      error: function() {
        consoleErr('Network error.');
      }
    });
  });
}

