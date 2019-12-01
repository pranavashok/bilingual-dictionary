require('dotenv').config({path : 'config.env'});

var express = require('express');
var app = express();

var path = require('path');
var cors = require('cors');
var azure = require('azure-storage');

// google analytics serverside
// var ua = require('universal-analytics');

// For mailing
var nodemailer = require('nodemailer');
var dateTime = require('node-datetime');
var bodyParser = require('body-parser');

// Sleep related
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

app.use(cors());
app.options('*', cors());

app.use(express.static(path.join(__dirname, 'public')));

// var robots = require('express-robots-txt');
// app.use(robots({UserAgent: '*', Disallow: ''}));

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
    },
    verbose: true, // This will now log to console.log, as well as Rollbar
});

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
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
            rollbar.error("Error occured when sending mail", error, {mailoptions: mailOptions}, req);
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

function remove_duplicate_by_word_and_category(req, result, column) {
    var unique = [];
    var categories = [];
    var keep_rows = [];
    result.entries.forEach(function(row) {
        // If word is new or else if word category pair is new, then add it to results
        // the else case is when word and category is same, but more details might have other information
        if (!row.hasOwnProperty(column)) {
            rollbar.error("Error: column doesn't exist in row", {row: row, column: column}, req);
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

function unique_entries_by_column(req, entries, column) {
	unique_entries = [];
	unique_words = [];
	entries.forEach(function(row) {
        if (!row.hasOwnProperty(column)) {
            rollbar.error("unique_entries_by_column() failed", {entries: entries, column: column}, req);
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
            rollbar.error("Error occured in startswith_query", error, {param1: search_param.toLowerCase(), param2: next_word(search_param).toLowerCase()}, req);
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
                rollbar.error("Error occured in containingwords_query", error, {param1:  search_param.toLowerCase(), param2: next_word(search_param).toLowerCase()}, req);
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
                rollbar.error("Error occured when inserting entity into searchlog", error, {entity: task}, req);
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
                rollbar.error("get_word(): Error occured in exact_word_query", error, {param1: word.toLowerCase(), param2: next_word(word).toLowerCase(), param3: primary_column, param4: word.toLowerCase()}, req);
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
            main_result.entries = remove_duplicate_by_word_and_category(req, result, secondary_column);

            // Pick entries which contain query word in any way
            var related_entries = [];
            tableService.queryEntities(suggest_table, containingwords_query, null, function(error, result, response) {
                if (error) {
                    rollbar.error("get_word(): Error occured in containingwords_query", error, {param: word.toLowerCase()}, req);
                }
                else if(result.entries.length > 0) {
                    related_entries = unique_entries_by_column(req, result.entries, 'ParentWord');
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
                        rollbar.error("get_word(): Error occured in samesubcat_query", error, {param1: constraint_string.join(" or "), param2: constraints}, req);
                    }
                    else if (result.entries.length > 0) {
                        all_subcat_entries = group_by_subcat(result.entries);
                        all_subcat_entries.forEach(function(list, index) {
                            list = unique_entries_by_column(req, list, primary_column);
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
                rollbar.error("Error occured when inserting entity into searchlog", error, {entity: task}, req);
            }
        }); 
    }
}

app.get("/words/:word", get_word);

var contentList = ["Living things", "Animal kingdom", "Animals", "Mammal", "Bird", "Reptiles and amphibians", "Arthropods", "Aquatic animals", "Worms and snails", "Body parts of animals", "Animal sounds", "Excreta of animals", "Animal homes", "Animal brood", "Other words related to animals", "Adjective related to animals", "Human beings", "Parts of human body", "Secretions and excretions", "Disease, illness, malady", "Symptoms and other disorders", "Words related to hair", "Words related to skin", "Words describing features of body", "Other words related to human body", "Plant kingdom", "Plant life", "Plants variety", "Flowering plants", "Flowers from trees", "Flowers from shrubs and herbs", "Flowers from creepers, bushes", "Flowers from aquatic plants", "Fruit plants", "Fruits and nuts from trees", "Fruits from creepers and vines", "Grain and pulses", "Medicinal plants", "Medicinal trees", "Medicinal shrubs, small trees", "Medicinal herbs", "Medicinal creepers and vines", "Millets", "Oilseeds", "Spices", "Timber trees", "Vegetables", "Leafy vegetables", "Vegetables on shrubs", "Vegetables from trees", "Vegetables from creepers, climbers", "Tubers, corms and bulbs used as vegetables", "Other useful trees, shrubs", "Plant Parts", "Parts of plants", "Parts of jackfruit tree", "Parts of plantain tree", "Parts of betel palm", "Parts of a coconut palm", "Parts of a mango tree", "Parts of paddy", "Other words related to plants", "Non-living things", "Clothing and jewellery", "Apparel and foot wear", "Types of sarees", "Other words related to apparel", "Fabric or cloth", "Jewellery", "Gems", "Buildings", "Parts of a house or building", "Rooms of a house", "Prayer room", "Inside house", "Furniture", "Other items inside house", "Sleeping paraphernalia in bedroom", "Kitchen", "Items in Kitchen", "Cooking oils", "Grocery etc.", "Other items in kitchen", "Residue, remnants", "Utensils and accessories", "Bath room", "Tools, instruments, weapons", "Outside house", "Language, food and culture", "Language", "Baby language", "Baby language nouns", "Baby language verbs", "Affectionate words for baby's body parts", "Words of address", "Compound words", "Compound adjectives", "Compound adverbs", "Compound nouns", "Echo words", "Languages", "Lexical doublets", "Lexical doublet adjectives", "Lexical doublet adverbs", "Lexical doublet nouns", "Proverbs", "Riddles", "Reduplicative words", "Adjective-adjective Reduplication 1", "Adjective-adjective Reduplication 2", "Adverb-adverb Reduplication", "Function Reduplication", "Noun-noun Reduplication: quantitative 1", "Noun-noun Reduplication: quantitative 2", "Noun-noun Reduplication: quantitative 3", "Numeral numeral Reduplication", "Possessive Reduplication", "Verb-verb Reduplication", "Simile", "Case form", "Idioms", "Imperatives", "Imperative verbs", "Negative imperatives", "Requesting imperatives", "Interrogatives", "Interrogative phrases", "Interrogative words", "Opposites, antonyms", "Onomatopoeic words", "Onomatopoeic adjectives", "Onomatopoeic adverbs", "Onomatopoeic nouns", "Onomatopoeic verbs", "Onomatopoeic verbs starting with letter क", "Onomatopoeic verbs starting with letter ख", "Onomatopoeic verbs starting with letter ग", "Onomatopoeic verbs starting with letter घ", "Onomatopoeic verbs starting with letter च", "Onomatopoeic verbs starting with letters छ, ज and झ", "Onomatopoeic verbs starting with letters ट, ठ and ड", "Onomatopoeic verbs starting with letters त, थ, द, ध and न", "Onomatopoeic verbs starting with letter प", "Onomatopoeic verbs starting with letter फ", "Onomatopoeic verbs starting with letters ब and भ", "Onomatopoeic verbs starting with letter म", "Onomatopoeic verbs starting with letters य, र and ल", "Onomatopoeic verbs starting with letter व", "Onomatopoeic verbs starting with letters श, स and ष", "Onomatopoeic verbs starting with letter ह", "Parts of Speech", "Adjectives", "Adjectives for action", "Adjectives for age", "Adjectives for appearance", "Adjectives for circumstances", "Adjectives for colour", "Adjectives for condition of food", "Adjectives for condition of nature", "Adjectives for condition of objects", "Adjectives for condition of person", "Adjectives for condition of place", "Adjectives for direction", "Adjectives for domicile", "Adjectives for emotion or feeling", "Adjectives for features for nature", "Adjectives for features of food", "Adjectives for features of objects", "Adjectives for general location", "Adjectives for location on body", "Adjectives for material", "Adjectives for opinion, perception, impression", "Adjectives for personality", "Adjectives for position", "Adjectives for purpose", "Adjectives for quantity", "Adjectives for relation", "Adjectives for shapes and patterns", "Adjectives for situations", "Adjectives for size", "Adjectives for smell", "Adjectives for sound", "Adjectives for speed", "Adjectives for taste", "Adjectives for temperature", "Adjectives for time period", "Adjectives for topography", "Adjectives for touch", "Adjectives for traits", "Adjectives for type", "Adjectives for weight", "Complimentary adjectives", "Definite numeral adjectives", "Demonstrative adjectives", "Indefinite numeral adjectives", "Other miscellaneous adjectives", "Other miscellaneous adjectives shared with other indian languages", "Adverbs", "Adverbs of Degree or Quantity", "Adverbs of Minimal", "Adverbs of Category", "Adverbs of Excess", "Adverbs of Comparison", "Adverbs of Adequate", "Adverbs of Manner", "Adverbs of Method", "Adverbs of Indecisiveness", "Adverbs of Decisiveness", "Adverbs of Purpose", "Adverbs of Negation", "Adverbs of Concept", "Adverbs of Description", "Adverbs of Affirmation", "Adverbs of Place", "Adverbs of Direction", "Adverbs of Position", "Adverbs of Time", "Adverbs of Time Point", "Adverbs of Frequency", "Adverbs of Duration", "Misc Adverbs", "Conjunction", "Nouns", "Abstract nouns", "Collective noun", "Common nouns", "Community nouns", "Countable nouns", "Countable nouns for aperture", "Mass nouns or uncountable nouns", "Nouns based on form", "Nouns denoting portion, share etc.", "Nouns for punishment", "Nouns related to dimension and state", "Nouns shared with other indian languages with konkanised spellings", "Occupational nouns", "Root word", "Sensory nouns", "Sensory nouns related to sight or appearance", "Sensory nouns related to smell", "Sensory nouns related to sound", "Sensory nouns related to taste", "Sensory nouns related to touch", "Special trait nouns", "Trait noun", "Uncountable nouns", "Verbal noun", "Preposition or Postpositions", "Pronouns", "Personal Pronouns", "Subjective Pronouns", "Objective Pronouns", "Demonstrative Pronouns", "Indefinite Pronouns", "Compound Personal Pronoun", "Reflexive Pronouns 1", "Reflexive Pronouns 2", "Intensive Pronouns", "Oblique case", "Possessive Pronouns", "Possessive Pronouns (Absolute 1)", "Possessive Pronouns (Absolute 2)", "Possessive Pronouns (Adjective 1)", "Possessive Pronouns (Adjective 2)", "Instrumental case of Pronouns 1", "Instrumental case of Pronouns 2", "Dative case of Pronouns 1", "Dative case of Pronouns 2", "Ablative case of Pronouns", "Accusative case of Pronouns", "Locative case of Pronouns 1", "Locative case of Pronouns 2", "Declension of Demonstrative Pronouns", "Verb", "Verbs starting with letter अ", "Verbs starting with letter आ", "Verbs starting with letters इ,ई and उ", "Verbs starting with letter ऊ", "Verbs starting with letters ए, ऐ, ओ and औ", "Verbs starting with letter क", "Verbs starting with letter का", "Verbs starting with letters कि and की", "Verbs starting with letters कु and कू", "Verbs starting with letters के, को and कौ", "Verbs starting with letter ख", "Verbs starting with letter खा", "Verbs starting with letters खि and खी", "Verbs starting with letters खु, खू, खे,and खै", "Verbs starting with letters खो and खौ", "Verbs starting with letter ग", "Verbs starting with letter गा", "Verbs starting with letters गि, गी, गु and गू", "Verbs starting with letters गो and गौ", "Verbs starting with letter घ", "Verbs starting with letter घा", "Verbs starting with letter घु and घू", "Verbs starting with letters घे, घै, घो and घौ", "Verbs starting with letter च", "Verbs starting with letter चा", "Verbs starting with letters चि and ची", "Verbs starting with letters चु, चू,चे and चै", "Verbs starting with letters चो and चौ", "Verbs starting with letter छ", "Verbs starting with letter ज", "Verbs starting with letter जा", "Verbs starting with letters जि and जी", "Verbs starting with letters जु, जू, जे and जै", "Verbs starting with letters जो and जौ", "Verbs starting with letters झ and झा", "Verbs starting with letters झि, झी, झु, झू, झे, झै, झो and झौ", "Verbs starting with letter ट", "Verbs starting with letter ड", "Verbs starting with letter ढ", "Verbs starting with letter त", "Verbs starting with letter ता", "Verbs starting with letters ति, ती, तु and तू", "Verbs starting with letters तृ, ते, तै, तो and तौ", "Verbs starting with letter थ", "Verbs starting with letters द and दा", "Verbs starting with letters दि and दी", "Verbs starting with letters दु and दू", "Verbs starting with letters दे, दै, दो and दौ", "Verbs starting with letters ध and धा", "Verbs starting with letters धि,धी,धु and धू", "Verbs starting with letters धे, धै, धो and धौ", "Verbs starting with letters न and ना", "Verbs starting with letter नि", "Verbs starting with letter नी", "Verbs starting with letters नु, नू, ने, नै, नो and नौ", "Verbs starting with letter न्ह", "Verbs starting with letter प", "Verbs starting with letter पा", "Verbs starting with letter पि", "Verbs starting with letter पी", "Verbs starting with letter पु", "Verbs starting with letter पू", "Verbs starting with letters पे and पै", "Verbs starting with letters पो and पौ", "Verbs starting with letter प्र", "Verbs starting with letter फ", "Verbs starting with letter फा", "Verbs starting with letters फि, फी, फु and फू", "Verbs starting with letters फे, फै, फो and फौ", "Verbs starting with letter ब", "Verbs starting with letter बा", "Verbs starting with letters बि, बी, बु and बू", "Verbs starting with letters बे and बै", "Verbs starting with letters बो and बौ", "Verbs starting with letters भ and भा", "Verbs starting with letters भि and भी", "Verbs starting with letters भु and भू", "Verbs starting with letters भे, भै, भो and भौ", "Verbs starting with letter म", "Verbs starting with letter मा", "Verbs starting with letters मि and मी", "Verbs starting with letters मु and मू", "Verbs starting with letters मृ, मे and मै", "Verbs starting with letters मो, मौ and म्ह", "Verbs starting with letter य", "Verbs starting with letter र", "Verbs starting with letters रा", "Verbs starting with letters रि and री", "Verbs starting with letters रु, रू, रे, रै, रो and रौ", "Verbs starting with letter ल", "Verbs starting with letter ला", "Verbs starting with letters लि, ली, ले and लै ", "Verbs starting with letters लो, लौ and ल्ह", "Verbs starting with letter व", "Verbs starting with letter वा", "Verbs starting with letters वि and वी", "Verbs starting with letters वे and वै", "Verbs starting with letters वो and वौ", "Verbs starting with letter व्ह", "Verbs starting with letters श and शा", "Verbs starting with letters शि and शी", "Verbs starting with letters शु, शू, शे and शै", "Verbs starting with letters शो, शौ, श्र and श्व", "Verbs starting with letter स", "Verbs starting with letter सा", "Verbs starting with letters सि, सी, सु and सू", "Verbs starting with letters से, सै, सो and सौ", "Verbs starting with letters स्त, स्थ, स्फ and स्व", "Verbs starting with letter ह", "Verbs starting with letter हा", "Verbs starting with letters हि, ही, हु and हू", "Verbs starting with letters हे, है, हो and हौ", "Singular-plural", "Immediate Future", "Probable Future tense", "Transitional phrases", "Transitional words based on Time, Cronology, Sequence", "Transitional words based on Cause and Effect", "Food", "Cooked food", "Water and beverages", "Sweets", "Sweet food items", "Ball shaped sweet", "Sweet flat bread", "Jelly like sweet", "Soft flat sweet", "Soft rice sweet", "Semolina pudding", "Sweet batter covered ball", "Sweet flat dumpling", "Sweet mix", "Indian dessert", "Sweet pudding with jaggery or sugar", "Sweet fruit pudding", "Sweet pudding dessert", "Sweet pudding", "Sweet and savoury dishes", "Sweet dishes", "Sweet savoury dish of fruits", "Sweet fruit dish", "Thin sweet dish", "Sweet savoury dish with coconut", "Sweet savoury dry dish", "Deep fried food items", "Deep fried snacks", "Spicy deep fried fritter of chickpea batter", "Deep fried dry snacks", "Deep fried chips", "Deep fried finger chips", "Spicy deep fried fritter of rice flour", "Steamed cakes and pancakes", "Indian pancake", "Steamed cakes", "Moist snacks", "Variety of cooked rice", "Main dishes", "Spiced curry used to mix with rice", "Weak slightly sour dish with coconut", "Major dish", "Main curry with curd", "Main curry with coconut", "Main curry or dish", "Main curry or dish with a roasted and ground coconut masala", "Sub dishes", "Sub curry or dish", "Sub dish with coconut", "Sub dish with buttermilk", "Wet sub dish", "Side dish", "Coconut based stir fry", "Dry sub dish", "Salad or cold dish", "Cold dish", "Hot spicy pickle and stuff", "Hot spicy", "Fresh sour fruits seasoned", "Wet pickle", "Dry pickle", "Fresh pickle", "Squeezed pickle", "Pounded and crushed pickle", "Fresh pickle with fried vegetables", "Spicy hot curry", "Cured and dried", "Dried and fried items", "Dried and deep fried items", "Sun dried fritters", "Cured, dried and deep fried", "Crispy thin cracker dried and deep fried", "Culture", "Sixteen rites of passage", "Marriage", "Other words related to wedding", "Words related to pre wedding", "Customs related to wedding ceremony", "Post wedding customs", "Eight auspicious items", "Gifts given to the groom", "Upanayanam or sacred thread ceremony", "words related to upanayanam", "Verbs related to upanayanam", "Other minor rites", "Death ceremony", "Other rituals and poojas", "Rangoli at tulasi", "Decorative or sacred mark", "Festivals", "Festivals celebrated at home", "Festivals celebrated at temples", "Rituals and poojas related to Navaratri;", "Other celebrations", "Community festivals", "Special food items made at homes on festival days", "Verbs related to customs and rituals", "Lengthy periods of worship", "Temple", "Words related to temple", "Verbs related to temple", "Parts of a temple", "Items used in temple", "Nivedhyams in temple", "Annual temple festival", "Relation", "Gotras", "Relationship", "Other nouns for relation", "Time and space", "Astrology and astronomy", "Nine planets of astrology", "Nine planets of solar system", "Corresponding western zodiac for hindu astrological stars", "Other words related to astrology", "Days of a week", "Fortnight", "Bright lunar fortnight or period of waxing moon", "Dark lunar fortnight or period of waning moon", "Months", "Time and Period", "Seasons", "Time", "Time and Period", "Words related to time and day", "Numbers and measurements", "Numbers", "Cardinal numbers", "Ordinal numbers, Numerical adjectives", "Measurements", "Length measured using body parts", "Width measured using hand", "Weight of gold measured using objects", "Depth measured using body parts", "Measure of quantity", "Quantity measured using hands", "Measures of volume for grains or liquid", "Measures adapted from Malayalam for grains", "Other words related to measurements", "Other general vocabulary", "Agriculture", "Nouns relating to agriculture", "Verbs related to agriculture", "Capital and accounts", "Colours", "Main colours", "Other colours", "Directions", "Edges and points", "Fireworks, pyrotechnics", "Flower strings", "Habitat", "Kings and kingdoms", "Languages", "Medicine", "Minerals", "Musical instruments", "Nature", "Paths and lanes", "Vehicles and parts", "Words related to games", "Extra vocabulary"];

app.get("/discover", function(req, res, next) {    
    var randomCategory = contentList[Math.floor(Math.random() * contentList.length)];

    var randomQuery = new azure.TableQuery()
                        .select(['PartitionKey', 'RowKey'])
                        .where("english_subcategory eq ?", randomCategory);

    tableService.queryEntities('dictkontoeng', randomQuery, null, function(error, result, response) {
        if (!error) {
            if (result.entries.length > 0) {
                var selectedEntry = result.entries[Math.floor(Math.random() * result.entries.length)];
                if (!selectedEntry.hasOwnProperty('PartitionKey')) {
                    rollbar.error("Selected random entry, but entry did not have PartitionKey", {entry: selectedEntry, category: randomCategory}, req);
                    res.redirect('/');
                } 
                else {
                    tableService.retrieveEntity('dictkontoeng', selectedEntry['PartitionKey']._, selectedEntry['RowKey']._, function(error, entity, response) {
                        if (error) {
                            rollbar.error("Could not fetch random entity", error, {random_entry: selectedEntry}, req);
                        } 
                        else {
                            console.info("Fetching", entity['konkani_word']._)
                            res.redirect('/words/' + entity['konkani_word']._);
                        }
                    });
                }
            }
            else {
                rollbar.warn("Possibly picked an empty category for discover", {subcategory: randomCategory}, req);
                res.redirect('/discover');
            }
        }
        else {
            rollbar.error("Could not execute randomQuery", error, {random_query: randomQuery}, req);
            res.redirect('/');
        }
    });
});

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
            rollbar.error("Error occured when running samesubcat_query", error, {param: category}, req);
        }
        else if(result.entries.length > 0) {
            samesubcat_entries = unique_entries_by_column(req, result.entries, 'konkani_word');
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

app.get("*", function(req, res) {
    rollbar.warning("A user tried to access an unavailable URL", req);
    res.redirect('/');
});

// Use the rollbar error handler to send exceptions to your rollbar account
app.use(rollbar.errorHandler());

app.listen(app.get('port'), app.get('ipaddress'), function() {
	console.log('App is running, server is listening on host:port ', app.get('ipaddress'), ':', app.get('port'));
});
