// Create clients and set shared const values outside of the handler

// Create a DocumentClient that represents the query to add an item
const dynamodb = require('aws-sdk/clients/dynamodb');

const docClient = new dynamodb.DocumentClient();

// Get the DynamoDB table name from environment variables
const tableName = process.env.DDNS_TABLE;

/**
 * Use HTTP PUT method to accept a DDNS IP update to be stored in the DynamoDB table.
 */
exports.putByNameHandler = async (event) => {
    const { body, httpMethod, path, pathParameters } = event;
    if (httpMethod !== 'PUT') {
        throw new Error(`Handler only accepts PUT method, you tried: ${httpMethod} method.`);
    }
    // All log statements are written to CloudWatch by default. For more information, see
    // https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-logging.html
    console.log('received:', JSON.stringify(event));

    // Get id and name from the body of the request
    const { ip } = JSON.parse(body);
    const { deviceName } = pathParameters;
    const lastUpdate=Date.now();
    const params = {
        TableName: tableName,
        Item: { deviceName, ip, lastUpdate},
    };
    
    // Creates a new item, or replaces an old item with a new item
    // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html#put-property
    await docClient.put(params).promise();

    const response = {
        statusCode: 200,
        body,
    };

    console.log(`response from: ${path} statusCode: ${response.statusCode} body: ${response.body}`);
    return response;
};
