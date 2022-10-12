// Import dynamodb from aws-sdk
const dynamodb = require('aws-sdk/clients/dynamodb');

// Import all functions from get-all-items.js
const lambda = require('../../../src/handlers/get-ddns-all-items.js');

// This includes all tests for getAllItemsHandler
describe('Test getAllItemsHandler', () => {
    let scanSpy;

    // One-time setup and teardown, see more in https://jestjs.io/docs/en/setup-teardown
    beforeAll(() => {
        // Mock DynamoDB scan method
        // https://jestjs.io/docs/en/jest-object.html#jestspyonobject-methodname
        scanSpy = jest.spyOn(dynamodb.DocumentClient.prototype, 'scan');
    });

    // Clean up mocks
    afterAll(() => {
        scanSpy.mockRestore();
    });

    // This test invokes getAllItemsHandler and compares the result
    it('should return ids', async () => {
        const items = [{ deviceName: 'id1', ip: "1.2.3.1" }, { deviceName: 'id2', ip: "1.2.3.2" }];

        // Return the specified value whenever the spied scan function is called
        scanSpy.mockReturnValue({
            promise: () => Promise.resolve({ Items: items }),
        });

        const event = {
            httpMethod: 'GET',
            "resource": "/ddns/devices/",
            "path": "/ddns/devices/"
        };

        // Invoke getAllItemsHandler
        const result = await lambda.getAllItemsHandler(event);

        const expectedResult = {
            statusCode: 200,
            body: JSON.stringify(items),
        };

        // Compare the result with the expected result
        expect(result).toEqual(expectedResult);
    });
});
