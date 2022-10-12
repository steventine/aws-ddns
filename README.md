# Dynamic DNS (DDNS) Backend Using Lambda, DynamoDB and Route53

This project contains source code and supporting files for a Dynamic DNS (DDNS) serverless application.  This application enables a client to publish it's current IP address to an HTTP function running in AWS Lambda.  The Lambda function stores the IP and current time in DynamoDB.  The DynamoDB write triggers another Lambda function to then create/update a Route53 DNS entry with the new IP address.  Optionally, another function periodically looks for stale IP addresses (ones where the client hasn't provided an IP address update in a configurable amount of time) and removes those stale DNS entries from Route53.  

You can update this application at any time by committing and pushing changes to your AWS CodeCommit or GitHub repository.  The original template for this project was a simple HTTP API example found on an AWS page, but I can't find it now.  It's been heavily modified to be a DDNS server so there is little code in common with the original, but I'd like to give credit to that project if I can find it!

This project includes the following files and folders:

- src - Code for the application's Lambda function.
- events - Invocation events that you can use to invoke the function.
- \_\_tests__ - Unit tests for the application code.
- template.yml - A SAM template that defines the application's AWS resources.
- buildspec.yml -  A build specification file that tells AWS CodeBuild how to create a deployment package for the function.

This Lambda application includes two AWS CloudFormation stacks. The first stack creates the pipeline that builds and deploys the application. The pipeline creates a second stack that contains the application's resources, including Lambda functions, an API Gateway API, and Amazon DynamoDB tables. These resources are defined in the `template.yml` file in this project. Updating the template will add AWS resources through the same deployment process that updates the application code (full infrastructure-as-code). View all the resources in the **Resources** section of the application overview in the Lambda console.

For a full list of possible operations, see the [AWS Lambda Applications documentation](https://docs.aws.amazon.com/lambda/latest/dg/deploying-lambda-apps.html).

## Changes needed to make this your own

If you take this application and use it, there are a few changes you'll need to make to the code after your first deployment:

- Update the DynamoDB table name to match your table name (from [DynamoDB](https://us-east-1.console.aws.amazon.com/dynamodbv2/home#tables))
  - Update the DDNS_TABLE variables in `env.json` (for running locally) and `.vscode/launch.json` (for debugging locally in VSCode)
- Update the Route53 DNS Zone to match your zone ID (from [Route53](https://us-east-1.console.aws.amazon.com/route53/v2/hostedzones#))
  - Update the DNS_ZONE variables in `env.json` (for running locally), `.vscode/launch.json` (for debugging locally in VSCode) and `template.yml` (for production use in AWS Lambda) 
- Update the DNS domain name to match your domain (from [Route53](https://us-east-1.console.aws.amazon.com/route53/v2/hostedzones#))
  - Update the DNS_DOMAIN variables in `env.json` (for running locally), `.vscode/launch.json` (for debugging locally in VSCode) and `template.yml` (for production use in AWS Lambda)  

## Try the application out

The application creates a RESTful API that takes HTTP requests and invokes Lambda functions. The API has PUT and GET methods on the `/ddns/devices/{deviceName}` resource to create and list items. It has a test GET method on the root `/ddns/devices/` resource to list all devices.  Each method maps to one of the application's three Lambda functions.

The application also has a DynamoDB Stream triggered function that watches for IP updates and pushes those updates to the Route53 DNS service.

Lastly, the application has a timer triggered prune function to find timed out entries (i.e. where we haven't heard an IP update from a device in some time)


**To use the sample API**

1. Choose the application from the [**Applications page**](https://console.aws.amazon.com/lambda/home#/applications) in the Lambda console. (Make sure you're in the right region)
1. Copy the URL that's listed under **API endpoint**.
1. At the command line, use cURL to send PUT requests providing your current IP address.

        $ ENDPOINT=<paste-your-endpoint-here>
        $ curl -d '{"ip":"1.2.3.4"}' -H "Content-Type: application/json" -X PUT $ENDPOINT/Prod/ddns/devices/Test111
        $ curl -d '{"ip":"1.2.3.5"}' -H "Content-Type: application/json" -X PUT $ENDPOINT/Prod/ddns/devices/Test111

1. Retrieve your current IP address
        $ curl $ENDPOINT/Prod/ddns/devices/Test111

1. Retrieve all the known IP addresses (you may want to disable this eventually)
        $ curl $ENDPOINT/Prod/ddns/devices/

1. If you have the project configured to update a DNS entry at your zone (like ddns.example.com) then you can lookup the IP
        $ nslookup test111.ddns.example.com

To view the application's API, functions, and table, use the links in the **Resources** section of the application overview in the Lambda console.

## Info on the AWS Serverless Application Model (SAM)

The application template uses the AWS Serverless Application Model (AWS SAM) to define application resources. AWS SAM is an extension of AWS CloudFormation with a simpler syntax for configuring common serverless application resources, such as functions, triggers, and APIs. For resources that aren't included in the [AWS SAM specification](https://github.com/awslabs/serverless-application-model/blob/master/versions/2016-10-31.md), you can use the standard [AWS CloudFormation resource types](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-template-resource-type-ref.html).

Update `template.yml` to add a dead-letter queue to your application. In the **Resources** section, add a resource named **MyQueue** with the type **AWS::SQS::Queue**.

```
Resources:
  MyQueue:
    Type: AWS::SQS::Queue
```

The dead-letter queue is a location for Lambda to send events that could not be processed. It's only really useful for the function that processes DynamoDB updates.

Commit the change and push.

```bash
git commit -am "Add dead-letter queue."
git push
```

**To see how the pipeline processes and deploys the change**

1. Open the [**Applications**](https://console.aws.amazon.com/lambda/home#/applications) page.
1. Choose your application.
1. Choose **Deployments**.

When the deployment completes, view the application resources on the **Overview** tab to see the new resource.

## Update the permissions boundary

The sample application applies a **permissions boundary** to its function's execution role. The permissions boundary limits the permissions that you can add to the function's role. Without the boundary, users with write access to the project repository could modify the project template to give the function permission to access resources and services outside of the scope of the sample application.

In order for the function to use the queue that you added in the previous step, you must extend the permissions boundary. The Lambda console detects resources that aren't in the permissions boundary and provides an updated policy that you can use to update it.

**To update the application's permissions boundary**

1. Open the [**Applications**](https://console.aws.amazon.com/lambda/home#/applications) page.
1. Choose your application.
1. Choose **Edit permissions boundary**.
1. Follow the instructions shown to update the boundary to allow access to the new queue.

## Add a dead-letter queue

A dead-letter queue can be useful to capture updates that can't be processed by the Lambda function. You'll need to grant the function permission to access the queue and configure the dead-letter queue setting.

In the function's properties in `template.yml`, add the **DeadLetterQueue** configuration. Under Policies, add **SQSSendMessagePolicy**. **SQSSendMessagePolicy** is a [policy template](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-policy-templates.html) that grants the function permission to send messages to a queue.

```
Resources:
  MyQueue:
    Type: AWS::SQS::Queue
  getAllItemsFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: ./
      Handler: src/handlers/get-all-items.getAllItemsHandler
      Runtime: nodejs14.x
      MemorySize: 128
      Timeout: 60
      DeadLetterQueue:
        Type: SQS
        TargetArn: !GetAtt MyQueue.Arn
      Policies:
        - SQSSendMessagePolicy:
            QueueName: !GetAtt MyQueue.QueueName
        - DynamoDBCrudPolicy:
            TableName: !Ref SampleTable
```

Commit and push the change. When the deployment completes, view the function in the console to see the updated configuration that specifies the dead-letter queue.

## Build and test locally

The AWS SAM command line interface (CLI) is an extension of the AWS CLI that adds functionality for building and testing Lambda applications. It uses Docker to run your functions in an Amazon Linux environment that matches Lambda. It can also emulate your application's build environment and API.

If you prefer to use an integrated development environment (IDE) to build and test your application, you can use the AWS Toolkit.
The AWS Toolkit is an open-source plugin for popular IDEs that uses the AWS SAM CLI to build and deploy serverless applications on AWS. The AWS Toolkit also adds step-through debugging for Lambda function code.

To get started, see the following:

* [PyCharm](https://docs.aws.amazon.com/toolkit-for-jetbrains/latest/userguide/welcome.html)
* [IntelliJ](https://docs.aws.amazon.com/toolkit-for-jetbrains/latest/userguide/welcome.html)
* [VS Code](https://docs.aws.amazon.com/toolkit-for-vscode/latest/userguide/welcome.html)
* [Visual Studio](https://docs.aws.amazon.com/toolkit-for-visual-studio/latest/user-guide/welcome.html)

To use the AWS SAM CLI with this sample, you need the following tools:

* AWS CLI - [Install the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html) and [configure it with your AWS credentials](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html).
* AWS SAM CLI - [Install the AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html).
* Docker - [Install Docker community edition](https://hub.docker.com/search/?type=edition&offering=community).

Build your application with the `sam build` command.

```bash
sam build -m package.json
```

The AWS SAM CLI installs dependencies that are defined in `package.json`, creates a deployment package, and saves its contents in the `.aws-sam/build` folder.

Test a single function by invoking it directly with a test event. An event is a JSON document that represents the input that the function receives from the event source. Test events are included in the `events` folder in this project.

Run functions locally and invoke them with the `sam local invoke` command.  Ensure you env.json file has sections that match exactly the names from the template.yml file (like putItemFunction)

```bash
sam local invoke putItemFunction --event events/event-post-item.json  --env-vars env.json
sam local invoke getAllItemsFunction --event events/event-get-all-items.json --env-vars env.json
sam local invoke ProcessDynamoDBStream --event events/event-db-stream-modify-ip.json --env-vars env.json
```

The AWS SAM CLI can also emulate your application's API. Use the `sam local start-api` command to run the API locally on port 3000.

```bash
sam local start-api --env-vars env.json
curl http://127.0.0.1:3000/ddns/devices/Test111
curl http://127.0.0.1:3000/ddns/devices/
curl -X PUT -d '{"ip":"1.2.3.6"}' -H "Content-Type: application/json" http://127.0.0.1:3000/ddns/devices/Test111
```

The AWS SAM CLI reads the application template to determine the API's routes and the functions that they invoke. The `Events` property on each function's definition includes the route and method for each path.

```yaml
      Events:
        Api:
          Type: Api
          Properties:
            Path: /
            Method: GET
```

## Unit tests

Requirements:

* Node.js - [Install Node.js 14.x](https://nodejs.org/en/), including the npm package management tool.

Tests are defined in the \_\_tests__ folder in this project. Use `npm` to install the [Jest test framework](https://jestjs.io/) and run unit tests.

```bash
my-application$ npm install
my-application$ npm run test
```

## Resources

For an introduction to the AWS SAM specification, the AWS SAM CLI, and serverless application concepts, see the [AWS SAM Developer Guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/what-is-sam.html).

I may look into publishing this to the AWS Serverless Application Repository.  Useful links for this are the [AWS Serverless Application Repository main page](https://aws.amazon.com/serverless/serverlessrepo/) and the [AWS Serverless Application Repository Developer Guide](https://docs.aws.amazon.com/serverlessrepo/latest/devguide/what-is-serverlessrepo.html).
