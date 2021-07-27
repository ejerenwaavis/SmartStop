function find(element) {
    const noResults = '<a class="dropdown-item text-center" href="#"><em>No match found, try suggesting an addition </em></a> '
    const searchPhrase = element.value;
    if (searchPhrase.length > 2) {
        $.get("/search/" + searchPhrase + "", (communities) => {
            if (communities) {
                // console.log(communities);
                $("#resultList").html("");
                communities.map(community => {
                    $("#resultList").append('<a class="dropdown-item text-truncate"  data=\'' + JSON.stringify(community) + '\' onclick="showCode(this)"><strong>' + community.communityName + '</strong>, ' + community.streets.join(', ') + '</a> ')
                });
            } else {
                $("#resultList").html(noResults)
            }

        });

    }
}


function showCode(element) {
    // $("#defaultCode").hide();
    var community = JSON.parse($(element).attr("data"));
    var searchedInfoHtml = "";
    for (gateCode of community.gateCodes) {
        var prefix = (gateCode.code.toString().length == 4 && gateCode.code.toString() !== "0000") ? "#" : "";
        searchedInfoHtml += '<p class="mb-0 mt-3"> ' + gateCode.description + ' </p> <h1 class="display-2 font-weight-bold mt-0 mb-0" id="label">' +
          ''+ prefix +''+   gateCode.code + '</h1>';
    }

    var defaultInfo = '<p class="mt-4 mb-0"> <em><b> '+  community.communityName + ' </b> Community</em></p>'+
      '<p class="display-5 mb-4 " id="gateCode-description"> <i>Streets inside: </i>' + community.streets.join(", ") + '</p>';

    // console.log(searchedInfoHtml);
    $("#adminStuff").hide();
    $("#defaultCode").hide();
    $("#serchedCode").html(searchedInfoHtml);
    $("#communityDescription").html(defaultInfo);
}

