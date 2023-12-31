import 'dotenv/config';

import type { AWS } from '@serverless/typescript';

// http
import hello from '@functions/http/hello';
import createChannel from '@functions/http/createChannel';
import getChannels from '@functions/http/getChannels';
import createMessage from '@functions/http/createMessage';
import getMessagesByChannel from '@functions/http/getMessagesByChannel';
import deleteMessage from '@functions/http/deleteMessage';
import updateMessage from '@functions/http/updateMessage';
import generateChannelUploadUrl from '@functions/http/generateChannelUploadUrl';
import getMyChannels from '@functions/http/getMyChannels';

// auth
import auth0Authorizer from '@functions/auth/auth0Authorizer';

// websocket
import connectHandler from '@functions/websocket/connectHandler';
import disconnectHandler from '@functions/websocket/disconnectHandler';

// dynamoDB
import sendMessage from '@functions/dynamoDB/sendMessage';

const region = process.env.REGION ?? 'us-east-1';
const stage = process.env.STAGE ?? 'dev';
const channelsTable = `Channels-${stage}`;
const messagesTable = `Messages-${stage}`;
const connectionsTable = `Connections-${stage}`;
const channelIdIndex = 'channelIdIndex';
const attachmentS3Bucket = `cloud-capstone-project-chat-app-${stage}`;

const serverlessConfiguration: AWS = {
  service: 'backend',
  frameworkVersion: '3',
  plugins: [
    'serverless-esbuild',
    'serverless-iam-roles-per-function',
    'serverless-plugin-tracing',
    'serverless-dynamodb',
    'serverless-offline',
  ],
  provider: {
    name: 'aws',
    runtime: 'nodejs14.x',
    apiGateway: {
      minimumCompressionSize: 1024,
      shouldStartNameWithService: true,
    },
    environment: {
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      NODE_OPTIONS: '--enable-source-maps --stack-trace-limit=1000',
      CHANNELS_TABLE: channelsTable,
      MESSAGES_TABLE: messagesTable,
      CONNECTIONS_TABLE: connectionsTable,
      API_GATEWAY_URL: {
        'Fn::Join': [
          '',
          [
            'https://',
            {
              Ref: 'WebsocketsApi',
            },
            '.execute-api.${self:custom.region}.amazonaws.com/${self:custom.stage}',
          ],
        ],
      },
      API_AUTH0: 'https://dev-fqiz0hf1no3st0ac.us.auth0.com',
      CHANNEL_ID_INDEX: channelIdIndex,
      ATTACHMENT_S3_BUCKET: attachmentS3Bucket,
      SIGNED_URL_EXPIRATION: '300',
    },
    tracing: {
      lambda: true,
      apiGateway: true,
    },
    iamRoleStatements: [
      {
        Effect: 'Allow',
        Action: ['xray:PutTraceSegments', 'xray:PutTelemetryRecords'],
        Resource: ['*'],
      },
    ],
    httpApi: {
      authorizers: {
        auth0Authorizer: {
          type: 'request',
          functionName: 'auth0Authorizer',
        },
      },
    },
  },
  // import the function via paths
  functions: {
    hello,
    createChannel,
    getChannels,
    createMessage,
    connectHandler,
    disconnectHandler,
    sendMessage,
    getMessagesByChannel,
    auth0Authorizer,
    deleteMessage,
    updateMessage,
    generateChannelUploadUrl,
    getMyChannels,
  },
  package: { individually: true },
  custom: {
    esbuild: {
      bundle: true,
      minify: false,
      sourcemap: true,
      exclude: ['aws-sdk'],
      target: 'node14',
      define: { 'require.resolve': undefined },
      platform: 'node',
      concurrency: 10,
    },
    stage: stage,
    region: region,
  },
  resources: {
    Resources: {
      GatewayResponseDefault4XX: {
        Type: 'AWS::ApiGateway::GatewayResponse',
        Properties: {
          ResponseParameters: {
            'gatewayresponse.header.Access-Control-Allow-Origin': "'*'",
            'gatewayresponse.header.Access-Control-Allow-Headers':
              "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
            'gatewayresponse.header.Access-Control-Allow-Methods':
              "'GET,OPTIONS,POST,DELETE'",
          },
          ResponseType: 'DEFAULT_4XX',
          RestApiId: {
            Ref: 'ApiGatewayRestApi',
          },
        },
      },
      ChannelsDynamoDBTable: {
        Type: 'AWS::DynamoDB::Table',
        Properties: {
          AttributeDefinitions: [
            {
              AttributeName: 'channelId',
              AttributeType: 'S',
            },
            {
              AttributeName: 'createdAt',
              AttributeType: 'S',
            },
            {
              AttributeName: 'userId',
              AttributeType: 'S',
            },
          ],
          KeySchema: [
            {
              AttributeName: 'userId',
              KeyType: 'HASH',
            },
            {
              AttributeName: 'channelId',
              KeyType: 'RANGE',
            },
          ],
          GlobalSecondaryIndexes: [
            {
              IndexName: channelIdIndex,
              KeySchema: [
                {
                  AttributeName: 'channelId',
                  KeyType: 'HASH',
                },
                {
                  AttributeName: 'createdAt',
                  KeyType: 'RANGE',
                },
              ],
              Projection: {
                ProjectionType: 'ALL',
              },
            },
          ],
          BillingMode: 'PAY_PER_REQUEST',
          TableName: channelsTable,
        },
      },
      MessagesDynamoDBTable: {
        Type: 'AWS::DynamoDB::Table',
        Properties: {
          AttributeDefinitions: [
            {
              AttributeName: 'channelId',
              AttributeType: 'S',
            },
            {
              AttributeName: 'createdAt',
              AttributeType: 'S',
            },
            {
              AttributeName: 'messageId',
              AttributeType: 'S',
            },
            {
              AttributeName: 'userId',
              AttributeType: 'S',
            },
          ],
          KeySchema: [
            {
              AttributeName: 'userId',
              KeyType: 'HASH',
            },
            {
              AttributeName: 'messageId',
              KeyType: 'RANGE',
            },
          ],
          GlobalSecondaryIndexes: [
            {
              IndexName: channelIdIndex,
              KeySchema: [
                {
                  AttributeName: 'channelId',
                  KeyType: 'HASH',
                },
                {
                  AttributeName: 'createdAt',
                  KeyType: 'RANGE',
                },
              ],
              Projection: {
                ProjectionType: 'ALL',
              },
            },
          ],
          BillingMode: 'PAY_PER_REQUEST',
          TableName: messagesTable,
          StreamSpecification: {
            StreamViewType: 'NEW_IMAGE',
          },
        },
      },
      ConnectionsDynamoDBTable: {
        Type: 'AWS::DynamoDB::Table',
        Properties: {
          AttributeDefinitions: [
            {
              AttributeName: 'id',
              AttributeType: 'S',
            },
          ],
          KeySchema: [
            {
              AttributeName: 'id',
              KeyType: 'HASH',
            },
          ],
          BillingMode: 'PAY_PER_REQUEST',
          TableName: connectionsTable,
        },
      },
      AttachmentsBucket: {
        Type: 'AWS::S3::Bucket',
        Properties: {
          BucketName: '${self:provider.environment.ATTACHMENT_S3_BUCKET}',
          PublicAccessBlockConfiguration: {
            BlockPublicPolicy: false,
            RestrictPublicBuckets: false,
          },
          CorsConfiguration: {
            CorsRules: [
              {
                AllowedOrigins: ['*'],
                AllowedHeaders: ['*'],
                AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
                MaxAge: 3000,
              },
            ],
          },
        },
      },
      BucketPolicy: {
        Type: 'AWS::S3::BucketPolicy',
        Properties: {
          PolicyDocument: {
            Id: 'MyPolicy',
            Version: '2012-10-17',
            Statement: [
              {
                Sid: 'PublicReadForGetBucketObjects',
                Effect: 'Allow',
                Principal: '*',
                Action: '*',
                Resource:
                  'arn:aws:s3:::${self:provider.environment.ATTACHMENT_S3_BUCKET}/*',
              },
            ],
          },
          Bucket: {
            Ref: 'AttachmentsBucket',
          },
        },
      },
    },
  },
};

module.exports = serverlessConfiguration;
