require('dotenv').config({path : 'config.env'});

var express = require('express')
var app = express()
var path = require('path');

var azure = require('azure-storage');

// For mailing
var nodemailer = require('nodemailer');
var dateTime = require('node-datetime');
var bodyParser = require('body-parser');

// TODO: express-recaptcha

var config = {
   storageAccount: process.env.AZURE_STORAGE_ACCOUNT,
   storageAccessKey: process.env.AZURE_STORAGE_ACCESS_KEY,
   connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
   db1: "dictengtokon",
   db2: "dictkontoeng"
};

var tableService = azure.createTableService();

app.set('ipaddress', (process.env.IP || "0.0.0.0"));
app.set('port', (process.env.PORT || 8080));

app.set('views', './views')
app.set('view engine', 'pug')

app.use(express.static(path.join(__dirname, 'public')));

app.locals.pretty = true;

app.use(function(req, res, next) {
	res.locals.user = req.user;
	next();
});

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
            console.log(error);
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

function unique_entries_by_column(entries, column) {
	unique_entries = [];
	unique_words = [];
	entries.forEach(function(row) {
		if (!unique_words.includes(row[column]._)) {
			unique_entries.push(row);
            unique_words.push(row[column]._);
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
					.select([primary_column])
					.top(30)
					.where("PartitionKey ge ? and PartitionKey lt ?", search_param.toLowerCase(), next_word(search_param).toLowerCase());

    var containingwords_query = new azure.TableQuery()
                    .select(['RowKey', 'ParentWord', 'StrippedWord'])
                    .where("PartitionKey ge ? and PartitionKey lt ?", search_param.toLowerCase(), next_word(search_param).toLowerCase());

	tableService.queryEntities(primary_table, startswith_query, null, function(error, result, response) {
		data += "<table class=\"results-table\" id=\"dict-results-table\">";
		if(!error && result.entries.length > 0) {
			data += "<thead><tr><td>Dictionary-style matches</td></tr></thead>";
			data += "<tbody>";
			
			var unique_words = unique_words_by_column(result.entries, primary_column);
			unique_words.forEach(function(word) {
				data += "<tr><td><a href=\"/words/" + word.replace(/ /g, '+') + "\">" + word + "</a></td></tr>";
			}, this);
			data += "</tbody>";
		} else {
			data += "<thead><tr><td>No exact matches</td></tr></thead>";
			data += "</thead>";
		}
		data += "</table>";

        // Pick entries which contain query word in any way
        tableService.queryEntities(suggest_table, containingwords_query, null, function(error, result, response) {
            data += "<table class=\"results-table\" id=\"suggested-results-table\">";
            if(!error && result.entries.length > 0) {
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
            } else {
                data += "<thead><tr><td>No other suggestions</td></tr></thead>";
                data += "</thead>";
            }
            data += "</table>";

            res.send(data);
        });

        // TODO: Ignore first word and pick stuff which are edit distance close, order them alphabetically

	});
});

app.get("/words/:word", function(req, res) {
	word = req.params.word.replace(/\+/g, ' ');
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

	// TODO: Update browse_count

	// TODO: Related words, same subcategory words

	var exact_word_query = new azure.TableQuery()
					.select([secondary_column, 'part_of_speech', 'english_subcategory', 'konkani_subcategory', 'more_details'])
					.where("PartitionKey ge ? and PartitionKey lt ? and " + primary_column + " eq ?", word.toLowerCase(), next_word(word).toLowerCase(), word.toLowerCase());

    var containingwords_query = new azure.TableQuery()
                    .select(['RowKey', 'ParentWord', 'StrippedWord'])
                    .where("PartitionKey eq ?", word.toLowerCase());

	tableService.queryEntities(primary_table, exact_word_query, null, function(error, result, response) {
		if(!error && result.entries.length > 0) {
            main_result = result;

            // Pick entries which contain query word in any way
            var related_entries = [];
            tableService.queryEntities(suggest_table, containingwords_query, null, function(error, result, response) {
                if(!error && result.entries.length > 0) {
                    related_entries = unique_entries_by_column(result.entries, 'ParentWord');
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
                tableService.queryEntities(primary_table, samesubcat_query, null, function(error, result, response) {
                    if(!error && result.entries.length > 0) {
                        all_subcat_entries = group_by_subcat(result.entries);
                        all_subcat_entries.forEach(function(list) {
                            list = unique_entries_by_column(list, primary_column);
                            list = sort_entries_by_column(list, "weight");
                        });
                    }

                    res.render('words',
                        { title: 'A Southern Konkani Vocabulary Collection',
                        heading: 'A Southern Konkani Vocabulary Collection',
                        heading_konkani: 'दक्षिण कोंकणी उतरावळि',
                        query: word,
                        words: main_result.entries,
                        related_words: related_entries,
                        same_subcat_words: all_subcat_entries
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
            });
        }
	});	

});

app.get("/category/:category", function(req, res) {
    category = req.params.category.replace(/\+/g, ' ');

    // TODO: Update browse_count

    // TODO: Related words, same subcategory words

    // Same subcategory words
    var samesubcat_query = new azure.TableQuery()
                .select(['konkani_word', 'english_subcategory', 'konkani_subcategory'])
                .where('english_subcategory eq ?', category);

    var samesubcat_entries = [];
    tableService.queryEntities('dictkontoeng', samesubcat_query, null, function(error, result, response) {
        if(!error && result.entries.length > 0) {
            samesubcat_entries = unique_entries_by_column(result.entries, 'konkani_word');

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