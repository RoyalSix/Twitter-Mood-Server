var mysql = require('mysql');

exports.connect = function (done) {
    try {
        this.connection = mysql.createConnection({
            host: '35.188.96.16',
            user: 'jay',
            password: 'donkey',
            database: 'bayes'
        });
        this.connection.connect();
        done();
    } catch (e) {
        done(e)
    }
}

exports.storeBayesInDB = function (bayesObj, done) {
    const vocab = bayesObj.vocabulary
    var wordCountFreqPos = 0;
    var wordCountFreqNeg = 0;
    for (var vocabWord in vocab) {
        if (bayesObj["wordFrequencyCount"]["positive"][vocabWord]) {
            wordCountFreqPos = bayesObj["wordFrequencyCount"]["positive"][vocabWord];
        }
        if (bayesObj["wordFrequencyCount"]["negative"][vocabWord]) {
            wordCountFreqNeg = bayesObj["wordFrequencyCount"]["negative"][vocabWord];
        }
        this.connection.query(`INSERT INTO vocab (vocab_key, freqCountPos, freqCountNeg) VALUES ('${vocabWord}', ${wordCountFreqPos} , ${wordCountFreqNeg});`, function (err, rows, fields) {
            if (!err)
                console.log('The solution is: ', rows);
            else
                console.log('Error while performing Query.');
        });
    }
}

exports.storeFollowersInDB = function (followersObj, done) {
    for (var classifier in followersObj) {
        var currentClass = followersObj[classifier];
        for (var follower of currentClass) {
            if (classifier == "n") {
                follower.classifier = "negative";
            }
            else if (classifier == "p") {
                follower.classifier = "positive";
            }
            else continue;
            this.connection.query(`INSERT INTO followers (amount, username, classifier) VALUES (${follower.followers}, '${follower.username}' , '${follower.classifier}');`, function (err, rows, fields) {
                if (!err)
                    console.log('The solution is: ', rows);
                else
                    console.log('Error while performing Query.');
            });
        }
    }
}

exports.getBayesFromDB = function (done) {
    var bayesObj = {
        categories: {},
        docCount: {},
        totalDocuments: {},
        vocabulary: {},
        vocabularySize: {},
        wordCount: {},
        wordFrequencyCount: {},
        options: {}
    };
    this.connection.query(`SELECT * FROM vocab`, (err, vocabRows, fields) => {
        this.connection.query(`SELECT * FROM counts`, (err, countRows, fields) => {
            var totalDocuments = 0;
            for (var classifier of countRows) {
                bayesObj.categories[classifier.classifierType] = true;
                bayesObj.docCount[classifier.classifierType] = classifier.docCount;
                bayesObj.wordCount[classifier.classifierType] = classifier.wordCount;
                bayesObj.wordFrequencyCount[classifier.classifierType] = {};
                totalDocuments += classifier.docCount;
                for (var vocabWord of vocabRows) {
                    bayesObj.wordFrequencyCount[classifier.classifierType][vocabWord.vocab_key] = vocabWord[classifier.classifierType];
                }
            }
            bayesObj.totalDocuments = totalDocuments;
            var vocabularySize = 0;
            for (var vocabWord of vocabRows) {
                vocabularySize += 1;
                bayesObj.vocabulary[vocabWord.vocab_key] = true;
            }
            bayesObj.vocabularySize = vocabularySize;
            done(bayesObj)
        });
    });
}

exports.getFollowersData = function (done) {
    this.connection.query(`SELECT * FROM followers`, (err, rows, fields) => {
        done(rows)
    });
}

exports.insertFollower = function (amount, username, classifier) {
    this.connection.query(`INSERT INTO followers (amount, username, classifier) VALUES (${amount}, '${username}' , '${classifier}');`, function (err, rows, fields) {
        if (err) console.log('Error while performing Query.');
    });
}

exports.updateCountsInstance = function (bayesObj) {
    for (var category in bayesObj.categories) {
        var docCount = bayesObj.docCount[category];
        var wordCount = bayesObj.wordCount[category];
        this.connection.query(`INSERT INTO counts (wordCount, docCount, classifierType) VALUES (${wordCount}, ${docCount}, '${category}') ON DUPLICATE KEY UPDATE docCount=${docCount}, wordCount=${wordCount};`, function (err, rows, fields) {
            if (err) console.log('Error while performing Query.');
        });
    }
}

exports.updateVocabInstance = function (bayesObj) {
    var freqObj = bayesObj["wordFrequencyCount"];
    for (var classifier in freqObj) {
        var classifierObj = freqObj[classifier];
        for (var word in classifierObj) {
            this.connection.query(`INSERT INTO vocab (vocab_key, ${classifier}) VALUES ('${word}', ${classifierObj[word]}) ON DUPLICATE KEY UPDATE ${classifier}=${classifierObj[word]}`, function (err, rows, fields) {
                if (err) console.log('Error while performing Query.');
            });
        }
    }
}