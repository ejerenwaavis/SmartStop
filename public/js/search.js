// ── Search with 300 ms debounce ───────────────────────
var searchTimer = null;

function find(element) {
    clearTimeout(searchTimer);
    var phrase = element.value.trim();
    if (phrase.length < 3) {
        closeResults();
        return;
    }
    searchTimer = setTimeout(function () {
        runSearch(phrase);
    }, 300);
}

function runSearch(phrase) {
    $.get(domain + '/search/' + encodeURIComponent(phrase), function (communities) {
        var list = $('#resultList');
        list.html('');
        if (communities && communities.length) {
            communities.forEach(function (community) {
                var data = JSON.stringify(community).replace(/'/g, '&#39;');
                var streets = community.streets.slice(0, 3).join(', ');
                if (community.streets.length > 3) streets += '&hellip;';
                list.append(
                    '<div class="search-result-item" data=\'' + data + '\' onclick="showCode(this)">' +
                    '<div class="search-result-name">' + community.communityName + '</div>' +
                    '<div class="search-result-streets">' + streets + '</div>' +
                    '</div>'
                );
            });
            list.addClass('open');
        } else {
            closeResults();
            var safePhrase = $('<span>').text(phrase).html();
            $('#communityDescription').html(
                '<div class="no-results-banner">'+
                '<i class="fas fa-search-minus me-2" style="opacity:.45"></i>'+
                'No communities found for <strong>\u201c' + safePhrase + '\u201d</strong>'+
                '</div>'
            );
            $('#searchedCode').html('');
        }
    }).fail(function () {
        closeResults();
    });
}

function closeResults() {
    $('#resultList').removeClass('open').html('');
}

// Close results when clicking outside
$(document).on('click', function (e) {
    if (!$(e.target).closest('.search-wrapper').length) {
        closeResults();
    }
});

function showCode(element) {
    var community = JSON.parse($(element).attr('data'));

    // Build community info card
    var streetBadges = community.streets.map(function (s) {
        return '<span class="street-badge"><i class="fas fa-road me-1"></i>' + s + '</span>';
    }).join('');

    var communityHtml =
        '<div class="community-card">' +
        '<p class="community-name"><i class="fas fa-map-marker-alt me-1" style="color:var(--clr-accent)"></i>' +
        community.communityName + ' Community</p>' +
        '<div class="streets-row">' + streetBadges + '</div>' +
        '</div>';

    // Build gate code cards
    var codeHtml = '';
    if (community.gateCodes && community.gateCodes.length) {
        codeHtml += '<p class="gate-codes-section-label"><i class="fas fa-key me-1"></i> Gate Codes</p>';
        community.gateCodes.forEach(function (gc) {
            var prefix = (gc.code.toString().length === 4 && gc.code.toString() !== '0000') ? '#' : '';
            codeHtml +=
                '<div class="gate-code-card">' +
                '<p class="gate-code-label">' + (gc.description || 'Gate Code') + '</p>' +
                '<p class="gate-code-number">' + prefix + gc.code + '</p>' +
                '</div>';
        });    } else {
        codeHtml +=
            '<div class="gate-code-card" style="color:var(--clr-muted);text-align:center;padding:2rem">'+
            '<i class="fas fa-key fa-2x mb-2 d-block" style="opacity:.3"></i>'+
            '<p class="mb-0" style="font-size:.875rem">No gate codes on record for this community</p>'+
            '</div>';    }

    $('#adminStuff').hide();
    $('#adminInclude').addClass('d-none');
    $('#defaultCode').hide();
    $('#communityDescription').html(communityHtml);
    $('#searchedCode').html(codeHtml);
    closeResults();
    $('#search-field').val('');
}

