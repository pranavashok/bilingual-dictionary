$(function(){
    // Allow use of Date.now() on IE8 and earlier
    if (!Date.now) {
        Date.now = function() { return new Date().getTime(); }
    }

    // In order to make keyboard readonly, so that mobile 
    // keyboard doesn't pop up when using onscreen keyboard    
    $(".keyboard").hide();

    $('[data-toggle="tooltip"]').tooltip();
    
    var currentRequest = null;

    // Store all jobs in progress
    let jobs = {};

    // Kick off a new job by POST-ing to the server
    async function addJob(query) {
        let res = await fetch("searching/", {
            method: 'POST', 
            body: JSON.stringify({search: query}),
            headers: new Headers({
                'Content-Type': 'application/json'
            })
        });
        let job = await res.json();
        jobs[job.id] = {id: job.id, timestamp: Date.now(), state: "queued"};
        render();
    }

    // Fetch updates for each job
    // Possible states: completed, failed, delayed, active, waiting, paused, stuck or null.
    async function updateJobs() {
        for (let id of Object.keys(jobs)) {
            let res = await fetch(`/job/${id}`);
            let result = await res.json();
            if (!!jobs[id]) {
                if (result.state == "failed") {
                    delete jobs[id];
                } else {
                    jobs[id].state = result.state;
                    jobs[id].returnvalue = result.returnvalue;
                }
            }
            render();
        }
    }

    setInterval(updateJobs, 200);

    // Update the UI
    function render() {
        // TODO: Get the latest result from the job and put it inside '#results'
        max = 0;
        latestCompletedJob = null;
        for (let id of Object.keys(jobs)) {
            if (jobs[id].timestamp > max && jobs[id].state == "completed") {
                max = jobs[id].timestamp;
                latestCompletedJob = id;
            }
        }

        // TODO: In case all the jobs are failing, report error
        // html_result = "<table class=\"results-table\" id=\"dict-results-table\">";
        // html_result += "<thead><tr><td>Hmm, something has gone wrong</td></tr></thead>";
        // html_result += "</thead>";
        // html_result += "<tbody><tr><td>Try again in some time</td></tr></tbody>";
        // html_result += "</table>";

        if (latestCompletedJob === null) {
            if (!!document.getElementsByClassName("spinner-border")) {
                $('#results').html('<div class="d-flex justify-content-center"><div class="spinner-border" role="status"><span class="sr-only">Loading...</span></div></div>');
            }
        }
        else {
            job = jobs[latestCompletedJob];
            if (job.returnvalue.unique_words != null) {
                unique_words = job.returnvalue.unique_words;
                html_result = "<table class=\"results-table\" id=\"dict-results-table\">";
                html_result += "<thead><tr><td>Dictionary-style matches</td></tr></thead>";
                html_result += "<tbody>";		
                unique_words.forEach(function(word) {
                    html_result += "<tr><td><a href=\"/words/" + word.replace(/ /g, '+') + "\">" + word + "</a></td></tr>";
                }, this);
                html_result += "</tbody>";
            } else {
                html_result += "<thead><tr><td>No exact matches</td></tr></thead>";
                html_result += "</thead>";
            }
            html_result += "</table>";
            html_result += "<table class=\"results-table\" id=\"suggested-results-table\">";
            if (job.returnvalue.unique_suggested_words != null) {
                unique_suggested_words = job.returnvalue.unique_suggested_words;
                html_result += "<thead><tr><td>Suggested matches</td></tr></thead>";
                html_result += "<tbody>";
                unique_suggested_words.forEach(function(word) {
                    html_result += "<tr><td><a href=\"/words/" + word.replace(/ /g, '+') + "\">" + word + "</a></td></tr>";
                }, this);
                html_result += "</tbody>";
            } else {
                html_result += "<thead><tr><td>No other suggestions</td></tr></thead>";
                html_result += "</thead>";
            }
            html_result += "</table>";
            $('#results').html(html_result);
        }
        delete jobs[latestCompletedJob];
    }

    function triggerSearch() {
        let query = $("#search").val();
        $("#specific-results").fadeTo(200,0.1);
        if (!query) {
            $('#results').html("");
            return;
        } else {
            addJob(query);
        }

        // currentRequest = $.ajax({
        //     type: 'GET',
        //     data: 'search=' + query,
        //     url: '/searching',
        //     timeout: 10000,
        //     beforeSend : function() {
        //         // Code to show loader   
        //         console.log(`Querying ${query}...`)   
        //         $('#results').html('<div class="d-flex justify-content-center"><div class="spinner-border" role="status"><span class="sr-only">Loading...</span></div></div>');
        //         if(currentRequest != null) {
        //             currentRequest.abort();
        //         }
        //     },
        //     success: function(data) {
        //         console.log(`Success, original query: ${query}, result for query: ${data.search_param}`);
        //         if (query === data.search_param) {
        //             $('#results').html(data.result);
        //         }
        //     },
        //     error:function(jqXHR, textStatus){
        //         console.log("Entered error");
        //         if(textStatus === 'timeout')
        //         {     
        //             console.log("Timed out while searching");
        //             console.log("GET /searching?search=", query);
        //             //do something. Try again perhaps?
        //         }
        //         if (textStatus !== 'abort') {
        //             $('#results').html("Error occured, please try again in a while.");
        //         }
        //     }
        // });
    }

    $('#search').on('keyup', function(e) {
        // $(".homepage-container").animate({"margin-top": "0"}, "fast");
        $(".introduction").remove();

        if (e.key == 'Enter') {
            if ($("#dict-results-table > tbody:nth-child(2) > tr:nth-child(1) > td:nth-child(1) > a:nth-child(1)").length == 0) {
                console.warn("Enter pressed before results appeared");
                return;
            } else {
                window.location.href = $("#dict-results-table > tbody:nth-child(2) > tr:nth-child(1) > td:nth-child(1) > a:nth-child(1)")[0].href;
                $('#results').html('<div class="d-flex justify-content-center"><div class="spinner-border" role="status"><span class="sr-only">Loading...</span></div></div>');
                return;
            }
        }
        triggerSearch();
    });

    $('span.KeyboardKey').on('click', function(e) {
        // $(".homepage-container").animate({"margin-top": "0"}, "fast");
        triggerSearch();
    });

    $("#search").focusout(function(e) {
        setTimeout(function() {
            var isKbActive = $(".keyboard").is(':active');
            var clickingOnResult = $("#results").is(':active');
            // Show specific results only if 
            // focus is not on keyboard
            // focus is outside the result box
            if (!isKbActive && !clickingOnResult) {
                $("#specific-results").fadeTo(0,1);
                // Clear results
                // $("#results").html("");
            }
        }, 100);
    });

    $('.contents-toggle').click(function(e) {
        if (e.target.href.startsWith("javascript"))
            e.preventDefault();
        else {
            window.open(e.target.href, '_blank');
            e.preventDefault();
        }
      
        var $this = $(this);
      
        if ($this.next().hasClass('show')) {
            $this.next().removeClass('show');
            $this.next().slideUp(350);
        } else {
            // Enable the following two lines to collapse items when 
            // clicking on something not child of currently opened item
            // $this.parent().parent().find('li .inner').removeClass('show');
            // $this.parent().parent().find('li .inner').slideUp(350);
            
            $this.next().toggleClass('show');
            $this.next().slideToggle(350);
        }
    });

    $('.counter-count').each(function () {
        $(this).prop('Counter',0).animate({
            Counter: $(this).text()
        }, {
            duration: 5000,
            easing: 'swing',
            step: function (now) {
                $(this).text(Math.ceil(now));
            }
        });
    });

    $('form.suggest-form .btn-primary').click(function(e) {
        e.preventDefault();
        if ($("div.form-group > textarea#suggestion").val() === '') {
            $("#suggestion").addClass("is-invalid");
            return false;
        } else {
            $("#suggestion").removeClass("is-invalid");
        }
        $.ajax({
            type: "POST",
            url: "/submit-suggestion",
            timeout: 10000,
            data: { name: $("div.form-group > input#name").val(),
                    email: $("div.form-group > input#email").val(),
                    suggestion: $("div.form-group > textarea#suggestion").val() 
                },
            beforeSend: function(jqXHR, settings) {
                $('form.suggest-form .btn-primary').html("Processing...");
                $('form.suggest-form .btn-primary').prop("disabled", true);
            },
            success: function(data) {
                //show content
                if (data.startsWith("250")) {// 250 message received
                    $('form.suggest-form .btn-primary').html("Submitted");
                    $('form.suggest-form .btn-primary').prop("disabled", true);
                    $($("#success-modal-trigger").attr("data-target")).modal("show");
                } else {
                    // Same as error
                    $('form.suggest-form .btn-primary').html("Submit");
                    $('form.suggest-form .btn-primary').prop("disabled", false);
                    $($("#failure-modal-trigger").attr("data-target")).modal("show");
                }
            },
            error: function(jqXHR, textStatus, err) {
                //show error message
                $('form.suggest-form .btn-primary').html("Submit");
                $('form.suggest-form .btn-primary').prop("disabled", false);
                $($("#failure-modal-trigger").attr("data-target")).modal("show");
            }
        });

        // Grey button while trying to send email
        // On success, turn button text into "Submitted"
    });

    $('body').on('click', '#home-button', function(e) {
        e.preventDefault();
        document.location.href="/";
    });

    $('body').on('click', '#retry-button', function(e) {
        e.preventDefault();
        window.open("mailto:mail@suryaashok.in?subject=Suggestion%20via%20website&body=" + encodeURI($(".suggest-form #suggestion").val()), '_blank');
    });

    $('#showtoggle').click(function(){ $('#answer').toggle(); return false; });

    $("input[name='options']").change(function() {
        var method = $("input[name='options']:checked").val();
        switch (method) {
            case "roman":
                $("#search").attr("placeholder", "type an english word or change input method");
                break;
            case "nagari":
                $("#search").attr("placeholder", "type to transliterate into konkani");
                break;
            case "keyboard":
                $("#search").attr("placeholder", "type using the onscreen keyboard");
                break;
        }
        
    });
});

function onSceenKeyboard() {
    var isKbSelected = $("#opt-keyboard").is(":checked");
    var isMobile = window.matchMedia("only screen and (max-width: 760px)");
    var isKbVisible = $(".keyboard").is(':visible');

    if (isKbSelected && !isKbVisible) {
        if (isMobile.matches) {
            $("#search").attr('readonly', 'readonly');
        }
        $("#specific-results").fadeTo(0,0.05);
        $(".keyboard").show("slide");
    }

    if (!isKbSelected) {
        if (isMobile.matches) {
            $("#search").removeAttr('readonly').select();
        }
        $(".keyboard").hide("slide");
        $("#specific-results").fadeTo(0,1);
    }        
}