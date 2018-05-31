const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const unirest = require('unirest');
const VisualRecognitionV3 = require('watson-developer-cloud/visual-recognition/v3');

exports.handler = (event, context, callback) => {
  uploadImageToS3(event, function(err, imageUrl) {
    if (err != null) {
      return handleError(err, callback);
    }
    getFoodName(imageUrl, function(err, foodName) {
      if (err != null) {
        return handleError(err, callback);
      }
      getNutrition(foodName, function(err, nutritionFacts) {
        if (err != null) {
          return handleError(err, callback);
        }
        let response = {
          "statusCode": 200,
          "body": JSON.stringify(nutritionFacts),
          "isBase64Encoded": false
        };
        callback(null, response);
      });
    });
  });
};

function handleError(error, callback) {
  console.log(error);
  let response = {
    "statusCode": 500,
    "body": error.toString(),
    "isBase64Encoded": false
  };

  callback(null, response);
}

function uploadImageToS3(event, callback) {
  var imageName = event.requestContext.requestId + '.jpg';
  var imageBuffer = Buffer.from(JSON.parse(event.body).image, 'base64');

  var params = {
    Key: imageName,
    Body: imageBuffer,
    Bucket: 'nutrition-finder-images'
  };

  s3.upload(params, function(err, data) {
    if (err) {
      callback(err, null);
    } else {
      console.log(data);
      callback(null, data.Location);
    }
  });
}

function getFoodName(imageUrl, callback) {
  var visualRecognition = new VisualRecognitionV3({
    url: 'https://gateway.watsonplatform.net/visual-recognition/api',
    version: '2018-03-19',
    iam_apikey: 'eVhpTGsJ9BP8RpCiAtTURgXRgscgqlf5hkf8wEWVuX4q'
  });

  var params = {
    url: imageUrl,
    classifier_ids: ["food"]
  };

  visualRecognition.classify(params, function(err, response) {
    if (err) {
      callback(err, null);
    } else {
      console.log(response);
      var foodName = response.images[0].classifiers[0].classes[0].class;
      callback(null, foodName);
    }
  });
}

function getNutrition(foodName, callback) {
  unirest
    .get("https://nutritionix-api.p.mashape.com/v1_1/search/" +
      foodName + "?fields=item_name%2Cnf_calories%2Cnf_total_fat")
    .header("X-Mashape-Key", "m9TeetANyXmshi54UehLdicX1ph2p1yBBvBjsnKyqHgBwP8aZv")
    .header("Accept", "application/json")
    .end(function(result) {
      console.log(result.status, result.headers, JSON.stringify(result.body));
      var nutritionFacts = result.body.hits[0].fields;
      callback(null, nutritionFacts);
    });
}
