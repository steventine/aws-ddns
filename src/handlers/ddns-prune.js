// Create clients and set shared const values outside of the handler

// Create a DocumentClient that represents the query to find stale items
const dynamodb = require('aws-sdk/clients/dynamodb');

const docClient = new dynamodb.DocumentClient();

// Get the DynamoDB table name and prune time from environment variables
const tableName = process.env.DDNS_TABLE;
const pruneAgeInMin = process.env.PRUNE_AGE_MIN;

/**
 * Called periodically to remove old entries that haven't been updated in pruneAgeInMin minutes.
 */
exports.ddnsPruneHandler = async (event) => {
    // All log statements are written to CloudWatch by default. For more information, see
    // https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-logging.html
    console.log('Timer event received:', JSON.stringify(event));

    // Convert minutes to ms to determine the oldest timestamp that we consider 'active'
    const prune_timestamp=Date.now() - (pruneAgeInMin*60*1000);

    // Timestamp of 0 means it's a disabled entry so don't include those here
    var params = {
        TableName : tableName,
        FilterExpression : 'lastUpdate BETWEEN :one AND :recent',
        ExpressionAttributeValues : {
          ':one': 1,
          ':recent': prune_timestamp
        }
      };
/*      
      await docClient.scan(params, function(err, data) {
         if (err){
          console.log(`Scan error ${err}`);
         }else{
          console.log(`Data returned is ${data}`);
          data.Items.forEach(function(element, index, array){
            console.log(`Item ${index} is ${JSON.stringify(element)}`);
          });
         } 
      });
*/

//      params = {TableName : tableName};
      const { Items } = await docClient.scan(params).promise();
      console.log(`Second full scan returned ${JSON.stringify(Items)}`);
      Items.forEach((element, index, array)  => {
        console.log(`Item ${index} is ${JSON.stringify(element)}`);
      });

      //const params = {
    //    TableName: tableName,
    //    Item: { deviceName, ip, lastUpdate},
    //};
    
    // Creates a new item, or replaces an old item with a new item
    // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html#put-property
    //await docClient.put(params).promise();

    //const response = {
    //    statusCode: 200,
    //    body,
    //};

    console.log(`Done finding entries older than ${prune_timestamp}`);
    return;
};
