require('dotenv').config({path : 'config.env'});

var express = require('express')
var app = express()
var path = require('path');

var azure = require('azure-storage');

// For mailing
var nodemailer = require('nodemailer');
var dateTime = require('node-datetime');
var bodyParser = require('body-parser');

// Sleep related
var sleep = require('sleep');
function msleep(n) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, n);
}
function sleep(n) {
  msleep(n*1000);
}

// TODO: express-recaptcha

var config = {
   storageAccount: process.env.AZURE_STORAGE_ACCOUNT,
   storageAccessKey: process.env.AZURE_STORAGE_ACCESS_KEY,
   connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
   // Rollbar
   post_client_item: process.env.POST_CLIENT_ITEM_ACCESS_TOKEN,
   post_server_item: process.env.POST_SERVER_ITEM_ACCESS_TOKEN,
   env: process.env.NODE_ENV,
   db1: "dictengtokon",
   db2: "dictkontoeng"
};

var tableService = azure.createTableService();

app.set('ipaddress', (process.env.IP || "0.0.0.0"));
app.set('port', (process.env.PORT || 8080));

app.set('views', './views')
app.set('view engine', 'pug')

app.use(express.static(path.join(__dirname, 'public')));

// app.use(robots({UserAgent: '*', Disallow: '/'}))

app.locals.pretty = true;
app.locals.env = config.env;
app.locals.post_client_item = config.post_client_item; 

app.use(function(req, res, next) {
    res.locals.user = req.user;
    next();
});

// include and initialize the rollbar library with your access token
var Rollbar = require("rollbar");
var rollbar = new Rollbar({
    accessToken: config.post_server_item,
    captureUncaught: true,
    captureUnhandledRejections: true,
    payload: {
        environment: config.env
    }
});

app.use(allowCrossDomain);

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

app.get('/', function (req, res) {	
	res.render('index', { title: 'A Southern Konkani Vocabulary Collection', heading: 'A Southern Konkani Vocabulary Collection', heading_konkani: 'दक्षिण कोंकणी उतरावळि',});
})

app.get('/about', function (req, res) {	
    res.render('about', { title: 'A Southern Konkani Vocabulary Collection', heading: 'A Southern Konkani Vocabulary Collection', heading_konkani: 'दक्षिण कोंकणी उतरावळि',});
})

app.get('/contact', function (req, res) { 
    res.render('contact', { title: 'A Southern Konkani Vocabulary Collection', heading: 'A Southern Konkani Vocabulary Collection', heading_konkani: 'दक्षिण कोंकणी उतरावळि',});
})

app.get('/suggest', function (req, res) { 
    res.render('suggest', { title: 'A Southern Konkani Vocabulary Collection', heading: 'A Southern Konkani Vocabulary Collection', heading_konkani: 'दक्षिण कोंकणी उतरावळि',});
})

app.get('/contents', function (req, res) {   
    res.render('contents', { title: 'A Southern Konkani Vocabulary Collection', heading: 'A Southern Konkani Vocabulary Collection', heading_konkani: 'दक्षिण कोंकणी उतरावळि',});
})

app.post('/submit-suggestion', function(req, res) { 
    // create reusable transporter object using the default SMTP transport
    let transporter = nodemailer.createTransport({
        service: 'Zoho',
        host: this.service,
        port: 587,
        secureConnection: false, // use SSL
        auth: {
            user: process.env.SMTP_USERNAME,
            pass: process.env.SMTP_PASSWORD
        },
        tls:{
            ciphers:'SSLv3'
        }
    });

    var dt = dateTime.create();
    var formatted = dt.format('Y-m-d H:M:S');

    var name = req.body.name;
    var email = req.body.email;
    var suggestion = req.body.suggestion;

    // setup e-mail data with unicode symbols
    var mailOptions = {
        from: 'dict@suryaashok.in', // sender address
        to: 'mail@suryaashok.in', // list of receivers
        subject: 'Suggestion submitted on ' + formatted, // Subject line
        text: 'Name: ' + name + '; Email: ' + email + 
              '; Suggestion/feedback: ' + suggestion, // plaintext body
        html: '<strong>Name: </strong>' + name + '<br /><br />' +
              '<strong>Email: </strong>' + email + '<br /><br />' +
              '<strong>Suggestion/feedback</strong><br />' + suggestion + '<br />' // html body
    };
     
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error("Error occured when sending mail with options \n", mailOptions);
            console.error(error);
            return res.send(-1);
        }
        console.log('Message %s sent: %s', info.messageId, info.response);
        res.send(info.response);
    });
})

function group_by_subcat(entries) {
    var keys = []
    var values = []
    entries.forEach(function(row) {
        index = keys.indexOf(row.english_subcategory._)
        if (index >= 0) {
            values[index].push(row);
        } else {
            keys.push(row.english_subcategory._)
            values.push(new Array());
            values[values.length - 1].push(row);
        }
    });
    return values;
}

function remove_duplicate_by_word_and_category(result, column) {
    var unique = [];
    var categories = [];
    var keep_rows = [];
    result.entries.forEach(function(row) {
        // If word is new or else if word category pair is new, then add it to results
        // the else case is when word and category is same, but more details might have other information
        if (!row.hasOwnProperty(column)) {
            console.error("Error: column '", column, "' doesn't exist in row\n", row);
            return result;
        }
        if (!unique.includes(row[column]._) || (unique.includes(row[column]._) && categories[unique.indexOf(row[column]._)] != row.english_subcategory._)) {
            unique.push(row[column]._);
            categories.push(row.english_subcategory._);
            keep_rows.push(row);
        } else {
            index = unique.indexOf(row[column]._);
            if ((row.part_of_speech._ == keep_rows[index].part_of_speech._) && (row.more_details._ != keep_rows[index].more_details._)) {
                keep_rows[index].more_details._ = combine_more_details(row.more_details._, keep_rows[index].more_details._);
            }
            else {
                // If part of speech is different, then push it
                keep_rows.push(row);
            }
        }
    });
    return keep_rows;
}

function remove_nonsearchable(entries, column, num) {
    var keep = [];
    entries.forEach(function(row) {
        if (row.hasOwnProperty('searchable')) {
            if (!(row.searchable._ === num || row.searchable._ === String(num))) {
                keep.push(row);
            }
        } else {
            keep.push(row);
        }
    });
    return keep;
}

function combine_more_details(m1, m2) {
    if (m1 == "") {
        return m2;
    }
    if (m2 == "") {
        return m1;
    }

    try {
        m1 = JSON.parse(m1);
        m2 = JSON.parse(m2);
    } catch(ex) {
        console.log("Exception in combining more_details");
    }

    const result = {};
    let key;

    for (key in m1) {
      if(m1.hasOwnProperty(key)){
        result[key] = m1[key];
      }
    }

    for (key in m2) {
      if(m2.hasOwnProperty(key)){
        result[key] = m2[key];
      }
    }

    return result;
}

function unique_entries_by_column(entries, column) {
	unique_entries = [];
	unique_words = [];
	entries.forEach(function(row) {
        if (!row.hasOwnProperty(column)) {
            console.error("unique_entries_by_column() failed with \nEntries\n", entries, "\nColumn:", column);
            return entries;
        }
		if (!unique_words.includes(row[column]._)) {
			unique_entries.push(row);
            unique_words.push(row[column]._);
            // console.log("Adding ", row[column]);
            // console.log("Unique words", unique_words);
		}
	}, this);
	return unique_entries;
}

function unique_words_by_column(entries, column) {
    unique_words = [];
    entries.forEach(function(row) {
        if (row[column] && !unique_words.includes(row[column]._)) {
            unique_words.push(row[column]._);
        }
    }, this);
    return unique_words;
}

function sort_entries_by_column(entries, column) {
    var ordered = [];
    entries.sort(function(e1, e2) {
        if (e1.hasOwnProperty(column) && e2.hasOwnProperty(column)) {
            return e1[column]._ - e2[column]._;
        }
        else {
            return 0;
        }
    }).forEach(function(row) {
        ordered.push(row);
    });
    return ordered;
}

// Next word in dict order
function next_word(word) {
	length = word.length - 1;
	word_upper = word.substring(0, length) + String.fromCharCode(word[length].charCodeAt() + 1)
	return word_upper;
}

app.get('/searching', function(req, res) {
	search_param = req.query.search;

    // Handle empty requests
    if (search_param === "") {
        res.send("");
        return;
    }

	// If typing in English, then
	if (search_param.search(/^([\x00-\xFF]+)/) != -1) {
		primary_column = "english_word";
		secondary_column = "konkani_word";
		primary_table = config.db1;
		secondary_table = config.db2;
        suggest_table = 'suggesteng';
	} else {
		primary_column = "konkani_word";
		secondary_column = "english_word";
		primary_table = config.db2;
		secondary_table = config.db1;
        suggest_table = 'suggestkon';
	}
	
	var data = "";

	var startswith_query = new azure.TableQuery()
					.select([primary_column, 'searchable'])
					.top(30)
					.where("PartitionKey ge ? and PartitionKey lt ?", search_param.toLowerCase(), next_word(search_param).toLowerCase());

    var containingwords_query = new azure.TableQuery()
                    .select(['RowKey', 'ParentWord', 'StrippedWord'])
                    .top(30)
                    .where("PartitionKey ge ? and PartitionKey lt ?", search_param.toLowerCase(), next_word(search_param).toLowerCase());

	tableService.queryEntities(primary_table, startswith_query, null, function(error, result, response) {
		data += "<table class=\"results-table\" id=\"dict-results-table\">";
		if (error) { // Error case
            data += "<thead><tr><td>Hmm, something has gone wrong</td></tr></thead>";
            data += "</thead>";
            data += "<tbody><tr><td>Try again in some time</td></tr></tbody>";
            console.error("Error occured in startswith_query with parameters ", search_param.toLowerCase(), next_word(search_param).toLowerCase());
            console.error(error);
        }
        else if(result.entries.length > 0) {
			data += "<thead><tr><td>Dictionary-style matches</td></tr></thead>";
			data += "<tbody>";
			searchable_entries = remove_nonsearchable(result.entries, primary_column, 0);
			var unique_words = unique_words_by_column(searchable_entries, primary_column);
			unique_words.forEach(function(word) {
				data += "<tr><td><a href=\"/words/" + word.replace(/ /g, '+') + "\">" + word + "</a></td></tr>";
			}, this);
			data += "</tbody>";
		} else { // if (result.entries.length == 0)
            data += "<thead><tr><td>No exact matches</td></tr></thead>";
            data += "</thead>";
        }
		data += "</table>";

        // Pick entries which contain query word in any way
        tableService.queryEntities(suggest_table, containingwords_query, null, function(error, result, response) {
            data += "<table class=\"results-table\" id=\"suggested-results-table\">";
            
            if (error) { // Error case
                console.error("Error occured in containingwords_query with parameters ", search_param.toLowerCase(), next_word(search_param).toLowerCase());
                console.error(error);
            }
            else if(result.entries.length > 0) {
                data += "<thead><tr><td>Suggested matches</td></tr></thead>";
                data += "<tbody>";

                var unique_suggested_words = unique_words_by_column(result.entries, 'ParentWord');
                // Remove words which are already present in unique_words
                if (unique_words) {
                    unique_suggested_words = unique_suggested_words.filter(x => unique_words.indexOf(x) < 0 );
                }

                unique_suggested_words.forEach(function(word) {
                    data += "<tr><td><a href=\"/words/" + word.replace(/ /g, '+') + "\">" + word + "</a></td></tr>";
                }, this);
                data += "</tbody>";
            }
            else { // if (result.entries.length == 0)
                data += "<thead><tr><td>No other suggestions</td></tr></thead>";
                data += "</thead>";
            }
            
            data += "</table>";

            res.send(data);
        });

        // TODO: Ignore first word and pick stuff which are edit distance close, order them alphabetically

	});

    // Log searches
    if (search_param.length >= 3 && config.env === "production") {
        var task = {
            PartitionKey : {'_': primary_column, '$':'Edm.String'},
            RowKey: {'_': String(Date.now()), '$':'Edm.String'},
            query: {'_': search_param, '$':'Edm.String'},
            complete: {'_': false, '$': 'Edm.Boolean'}
        };
        tableService.insertEntity('searchlog', task, function(error) {
            if(error) {
                console.error("Error occured when inserting \n", task, "\n into searchlog");
                console.error(error);
            }
        }); 
    }
});

function get_word(req, res, next) {
    var discover = false;
    if (res.locals.word) {
        console.info("Random word ", res.locals.word, " chosen");
        word = res.locals.word;
        discover = true;
    }
    else 
        word = req.params.word;
    
    word = word.replace(/\+/g, ' ');

    // If typing in English, then
    if (word.search(/^([\x00-\xFF]+)/) != -1) {
        primary_column = "english_word";
        secondary_column = "konkani_word";
        primary_table = "dictengtokon";
        secondary_table = "dictkontoeng";
        suggest_table = 'suggesteng';
    } else {
        primary_column = "konkani_word";
        secondary_column = "english_word";
        primary_table = "dictkontoeng";
        secondary_table = "dictengtokon";
        suggest_table = 'suggestkon';
    }

    var exact_word_query = new azure.TableQuery()
                    .select([secondary_column, 'part_of_speech', 'english_subcategory', 'konkani_subcategory', 'more_details'])
                    .where("PartitionKey ge ? and PartitionKey lt ? and " + primary_column + " eq ?", word.toLowerCase(), next_word(word).toLowerCase(), word.toLowerCase());

    var containingwords_query = new azure.TableQuery()
                    .select(['RowKey', 'ParentWord', 'StrippedWord'])
                    .where("PartitionKey eq ?", word.toLowerCase());

    tableService.queryEntities(primary_table, exact_word_query, null, function(error, result, response) {
        if (error) {
                console.error("get_word(): Error occured in exact_word_query: ", "PartitionKey ge '", word.toLowerCase(), "' and PartitionKey lt '",  next_word(word).toLowerCase(), "' and " + primary_column + " eq '", word.toLowerCase(), "'");
                console.error(error);
                // TODO replace below with error page
                res.render('words',
                    { title: 'A Southern Konkani Vocabulary Collection',
                    heading: 'A Southern Konkani Vocabulary Collection',
                    heading_konkani: 'दक्षिण कोंकणी उतरावळि',
                    query: word,
                    words: [],
                    related_words: [],
                    same_subcat_words: []
                }, function(err, html) {
                    res.location('/words/' + word);
                    res.send(html);
                });
        } else if(result.entries.length > 0) {
            var main_result = {"entries": []};

            // Remove duplicates
            main_result.entries = remove_duplicate_by_word_and_category(result, secondary_column);

            // Pick entries which contain query word in any way
            var related_entries = [];
            tableService.queryEntities(suggest_table, containingwords_query, null, function(error, result, response) {
                if (error) {
                    console.error("get_word(): Error occured in containingwords_query with parameter ", word.toLowerCase());
                    console.error(error);
                }
                else if(result.entries.length > 0) {
                    related_entries = unique_entries_by_column(result.entries, 'ParentWord');
                    related_entries = related_entries.filter(x => x.ParentWord._ !== word);
                }
                else { // in case result.entries.length == 0
                    //
                }

                // Same subcategory words
                constraint_string = [];
                constraints = [];
                main_result.entries.forEach(function(row) {
                    constraint_string.push("english_subcategory eq ?");
                    constraints.push(row.english_subcategory._.replace("'", "''"));
                });
                var samesubcat_query = new azure.TableQuery()
                            .select([primary_column, 'english_subcategory', 'konkani_subcategory', 'weight'])
                            .where(constraint_string.join(" or "), ...constraints);

                var samesubcat_entries = [];
                var all_subcat_entries = [];
                tableService.queryEntities(primary_table, samesubcat_query, null, function(error, result, response) {
                    if (error) {
                        console.error("get_word(): Error occured in samesubcat_query with parameters: ", constraint_string.join(" or "), ...constraints);
                        console.error(error);
                    }
                    else if (result.entries.length > 0) {
                        all_subcat_entries = group_by_subcat(result.entries);
                        all_subcat_entries.forEach(function(list, index) {
                            list = unique_entries_by_column(list, primary_column);
                            all_subcat_entries[index] = sort_entries_by_column(list, "weight");
                        }, all_subcat_entries);
                    }

                    res.render('words',
                        { title: 'A Southern Konkani Vocabulary Collection',
                        heading: 'A Southern Konkani Vocabulary Collection',
                        heading_konkani: 'दक्षिण कोंकणी उतरावळि',
                        query: word,
                        words: main_result.entries,
                        related_words: related_entries,
                        same_subcat_words: all_subcat_entries
                    }, function(err, html) {
                        res.location('/words/' + word);
                        res.send(html);
                    });
                });
            });
        } else {
            res.render('words',
                    { title: 'A Southern Konkani Vocabulary Collection',
                    heading: 'A Southern Konkani Vocabulary Collection',
                    heading_konkani: 'दक्षिण कोंकणी उतरावळि',
                    query: word,
                    words: [],
                    related_words: [],
                    same_subcat_words: []
            }, function(err, html) {
                res.location('/words/' + word);
                res.send(html);
            });
        }
    }); 

    // Log words
    if (config.env === "production") {
        var task = {
            PartitionKey : {'_': primary_column, '$':'Edm.String'},
            RowKey: {'_': String(Date.now()), '$':'Edm.String'},
            query: {'_': word, '$':'Edm.String'},
            discover: {'_': discover, '$':'Edm.Boolean'},
            complete: {'_': true, '$': 'Edm.Boolean'}
        };
        tableService.insertEntity('searchlog', task, function(error) {
            if(error) {
                console.error("Error occured when inserting \n", task, "\n into searchlog");
                console.error(error);
            }
        }); 
    }
}

app.get("/words/:word", get_word);

app.get("/discover", function(req, res, next) {
    // Generate random key and check if there is an entry with that row key
    var found = false;
    var error_counter = 0;
    
    var randomRowKey = Math.floor(Math.random() * Math.floor(80000));

    var randomQuery = new azure.TableQuery()
                        .select(['PartitionKey', 'RowKey', 'ParentWord'])
                        .top(1)
                        .where("RowKey eq ?", String(randomRowKey));

    tableService.queryEntities('suggestkon', randomQuery, null, function(error, result, response) {
        if (!error) {
            if (result.entries.length > 0) {
                found = true;
                res.locals.word = result.entries[0].ParentWord._;
                next();
            } else {
                res.redirect('/discover');
            }
        } else {
            console.error("Error occured in randomQuery with parameter '", String(randomRowKey), "'");
            console.error(error);
            error_counter += 1; // TODO this won't really work because each time it gets reset to 0
            msleep(250*error_counter); // Sleep for milliseconds
            if (error_counter < 6) {
                res.redirect('/discover');
            } else {
                res.redirect('/');
            }
        }
    });
}, get_word);

app.get("/category/:category", function(req, res) {
    category = req.params.category.replace(/\+/g, ' ');

    // TODO: Update browse_count

    // TODO: Related words, same subcategory words

    // Same subcategory words
    var samesubcat_query = new azure.TableQuery()
                .select(['konkani_word', 'english_subcategory', 'konkani_subcategory', 'weight'])
                .where('english_subcategory eq ?', category);

    var samesubcat_entries = [];
    tableService.queryEntities('dictkontoeng', samesubcat_query, null, function(error, result, response) {
        if (error) {
            console.error("Error occured when running samesubcat_query with parameter ", category);
            console.error(error);
        }
        else if(result.entries.length > 0) {
            samesubcat_entries = unique_entries_by_column(result.entries, 'konkani_word');
            samesubcat_entries = sort_entries_by_column(samesubcat_entries, "weight");
            // TODO: Sort words by konkani
        } 

        res.render('subcategory',
            { title: 'A Southern Konkani Vocabulary Collection - दक्षिण कोंकणी उतरावळि',
            heading: 'A Southern Konkani Vocabulary Collection',
            heading_konkani: 'दक्षिण कोंकणी उतरावळि',
            same_subcat_words: samesubcat_entries
        });
    });
});

app.listen(app.get('port'), app.get('ipaddress'), function() {
	console.log('App is running, server is listening on host:port ', app.get('ipaddress'), ':', app.get('port'));
});
