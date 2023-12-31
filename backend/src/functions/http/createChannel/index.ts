import schema from './schema';
import { handlerPath } from '@libs/handler-resolver';

export default {
  handler: `${handlerPath(__dirname)}/handler.main`,
  events: [
    {
      http: {
        method: 'post',
        path: 'channels',
        cors: true,
        authorizer: {
          name: 'auth0Authorizer',
        },
        request: {
          schemas: {
            'application/json': schema,
          },
        },
      },
    },
  ],
  tracing: true,
  iamRoleStatements: [
    {
      Effect: 'Allow',
      Action: ['dynamodb:PutItem'],
      Resource: {
        'Fn::GetAtt': ['ChannelsDynamoDBTable', 'Arn'],
      },
    },
  ],
};
