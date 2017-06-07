var promise = require('bluebird');

var options = {
    // Initialization Options
    promiseLib: promise
};

var pgp = require('pg-promise')(options);
var connectionString = "postgres://bnmebswdqgjicd:f907372e8b598dbdf7bc0bceec322102f075b6ac5392540c691ac18482017a85@ec2-107-21-99-176.compute-1.amazonaws.com:5432/d65vbive6p3drk";
var db = pgp(connectionString);

// add query functions

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
    db.any('select * from vocab')
        .then(function (vocabRows) {
            db.any('select * from counts')
                .then(function (countRows) {
                    if (!countRows) return;
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
                })
        })
}

exports.getFollowersData = function (done) {
    db.any('select * from followers').then(done);
}

exports.insertFollower = function (amount, username, classifier) {
    db.none(`INSERT INTO followers (amount, username, classifier) VALUES (${amount}, '${username}' , '${classifier}');`).catch(function (err) {
      console.log('Error while performing Query.');
    });
}

exports.updateCountsInstance = function (bayesObj) {
    for (var category in bayesObj.categories) {
        var docCount = bayesObj.docCount[category];
        var wordCount = bayesObj.wordCount[category];
        db.none(`INSERT INTO counts (wordCount, docCount, classifierType) VALUES (${wordCount}, ${docCount}, '${category}') ON CONFLICT (classifierType) DO UPDATE SET docCount=${docCount}, wordCount=${wordCount};`).catch(function (err) {
            if (err) console.log('Error while performing Query.');
        });
    }
}

exports.updateVocabInstance = function (bayesObj) {
    var freqObj = bayesObj["wordFrequencyCount"];
    for (var classifier in freqObj) {
        var classifierObj = freqObj[classifier];
        for (var word in classifierObj) {
            this.connection.query(`INSERT INTO vocab (vocab_key, ${classifier}) VALUES ('${word}', ${classifierObj[word]}) ON CONFLICT (vocab_key) DO UPDATE SET ${classifier}=${classifierObj[word]}`).catch(function (err) {
                if (err) console.log('Error while performing Query.');
            });
        }
    }
}