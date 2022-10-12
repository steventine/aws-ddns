// Create clients and set shared const values outside of the handler

// Create a DocumentClient that represents the query to get an item and a Route53 client
const dynamodb = require('aws-sdk/clients/dynamodb');
const { Route53Client, ChangeResourceRecordSetsCommand } = require("@aws-sdk/client-route-53");

const docClient = new dynamodb.DocumentClient();

// Get the DynamoDB table name and DNS zone from environment variables
const tableName = process.env.DDNS_TABLE;
const dnsZone = process.env.DNS_ZONE;
const dnsDomain = process.env.DNS_DOMAIN;

/**
 * Handle when a DNS entry in DynamoDB has changed.
 */
exports.itemChangeHandler = async (event, context, callback) => {

    //Walk through each record that has changed
    event.Records.forEach((record) => {
        console.log('Stream record: ', JSON.stringify(record, null, 2));

        //Determine the type of change made on this record
        if (record.eventName == 'INSERT') {
            var newName = record.dynamodb.NewImage.deviceName.S;
            var newIp = record.dynamodb.NewImage.ip.S;
            var newTimestamp = record.dynamodb.NewImage.lastUpdate.N;

            console.log(`INSERT of ${newName} at ${newIp} updated ${newTimestamp}`);
            //TODO: Need to figure out the async side of this as it's
            //  returning before completing.
            updateRoute53DNS(newName, newIp);
        }else if (record.eventName == 'MODIFY'){
            var newName = record.dynamodb.NewImage.deviceName.S;
            var newIp = record.dynamodb.NewImage.ip.S;
            var newTimestamp = record.dynamodb.NewImage.lastUpdate.N;

            var oldName = record.dynamodb.OldImage.deviceName.S;
            var oldIp = record.dynamodb.OldImage.ip.S;
            var oldTimestamp = record.dynamodb.OldImage.lastUpdate.N;

            if (newName == oldName && newIp == oldIp){
                console.log(`Watchdog update for ${oldName}`)
            }else{
                console.log(`IP UPDATE of ${newName} from ${oldIp} to ${newIp} updated ${newTimestamp}`);
                //TODO: Need to figure out the async side of this as it's
                //  returning before completing.
                updateRoute53DNS(newName, newIp);
            }
        }else if (record.eventName == 'REMOVE'){
            var oldName = record.dynamodb.OldImage.deviceName.S;
            var oldIp = record.dynamodb.OldImage.ip.S;
            console.log(`DELETE of ${oldName} at ${oldIp}`);
            try{
                //TODO: Need to figure out the async side of this as it's
                //  returning before completing.
                deleteRoute53DNS(oldName, oldIp);
                console.log(`DNS entry removed`);
            } catch(error) {
                console.error(`DNS removal failed...assuming it doesn't exist`);
            }
        }
    });
    callback(null, `Successfully processed ${event.Records.length} records.`);
};

function isIpValid(ipaddress) 
{
    if (/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ipaddress))
    {
        return (true)
    }

    console.error(`IP address ${ipaddress} in invalid`);
    return (false)
}

async function updateRoute53DNS(name, ip){
    const client = new Route53Client({ region: "us-east-1" });
    if(name && name != "" && isIpValid(ip)){
        var params = {
            ChangeBatch: {
            Changes: [
                {
            Action: "UPSERT", 
            ResourceRecordSet: {
                Name: name + "." + dnsDomain, 
                ResourceRecords: [
                {
                Value: ip
                }
                ], 
                TTL: 60, 
                Type: "A"
            }
            }
            ], 
            Comment: "DDNS entry"
            }, 
            HostedZoneId: dnsZone
        };

        const command = new ChangeResourceRecordSetsCommand(params);
        console.log(`DNS Command: ${JSON.stringify(command)}`);
        try{
            const response = await client.send(command)
            console.log(`DNS Response: ${JSON.stringify(response)}`);
        } catch(error) {
            console.error(`DNS call failed: ${error}`);
            throw(error);
        } finally {
            // finally.
        }
    }else{
        console.error(`Tried to create a DNS entry with a invalid name (${name}) or IP (${ip})`);
        throw({errortype: "Invalid DNS Entry", errorMessage:"Name or IP are invalid"});
    }
};

async function deleteRoute53DNS(name, ip){
    const client = new Route53Client({ region: "us-east-1" });
    if(name && name != "" && isIpValid(ip)){
        var params = {
            ChangeBatch: {
            Changes: [
                {
            Action: "DELETE", 
            ResourceRecordSet: {
                Name: name + "." + dnsDomain, 
                ResourceRecords: [
                {
                Value: ip
                }
                ], 
                TTL: 60, 
                Type: "A"
            }
            }
            ], 
            Comment: "DDNS entry"
            }, 
            HostedZoneId: dnsZone
        };

        const command = new ChangeResourceRecordSetsCommand(params);
        console.log(`DNS Command: ${JSON.stringify(command)}`);
        try{
            const response = await client.send(command)
            console.log(`DNS Response: ${JSON.stringify(response)}`);
        } catch(error) {
            console.error(`DNS call failed: ${error}`);
            throw(error);
        } finally {
            // finally.
        }
    }else{
        console.error(`Tried to create a DNS entry with a invalid name (${name}) or IP (${ip})`);
        throw({errortype: "Invalid DNS Entry", errorMessage:"Name or IP are invalid"});
    }
};
