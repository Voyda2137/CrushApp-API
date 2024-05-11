import {Duration, Stack, StackProps} from 'aws-cdk-lib/core';
import {Construct} from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as apigw from 'aws-cdk-lib/aws-apigateway'
import {Cors} from 'aws-cdk-lib/aws-apigateway'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as s3 from 'aws-cdk-lib/aws-s3'
import {UserPool, UserPoolClient} from "aws-cdk-lib/aws-cognito";
import {IdentityPool, UserPoolAuthenticationProvider} from "@aws-cdk/aws-cognito-identitypool-alpha";

export class ProjektZpoStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    const userPool = new UserPool(this, 'KruszaraUserPool', {
      standardAttributes: {
        phoneNumber: {required: false},
        email: {
          required: true,
          mutable: true
        }
      },
      autoVerify: {email: true},
      signInAliases: {
        email: true
      },
      selfSignUpEnabled: true
    })

    const userPoolClient = new UserPoolClient(this, 'KruszaraUserPoolClient', {
      userPool,
      authFlows: {
        userPassword: true
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true
        }
      }
    })

    const identityPool = new IdentityPool(this, 'KruszaraIdentityPool', {
      identityPoolName: 'KruszaraIdentityPool',
      allowUnauthenticatedIdentities: true,
      authenticationProviders: {
        userPools: [
            new UserPoolAuthenticationProvider({
              userPool: userPool,
              userPoolClient: userPoolClient
            })
        ]
      }
    })

    const s3ReportsBucket = new s3.Bucket(this, 'reportsBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      bucketName: 'reports-cdk',
      enforceSSL: true
    })

    const integratorTable = new dynamodb.Table(this, 'IntegratorTable', {
      partitionKey: {name: 'PK', type: dynamodb.AttributeType.STRING},
      sortKey: {name: 'SK', type: dynamodb.AttributeType.STRING}
    })

    // Start user

    const userApi = new apigw.RestApi(this, 'UserApi', {
      restApiName: 'UserApi',
      defaultCorsPreflightOptions: {
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'Access-Control-Allow-Credentials',
          'Access-Control-Allow-Headers',
          'Impersonating-User-Sub',
          'X-Access-Token'
        ],
        allowMethods: ['OPTIONS', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        allowCredentials: true,
        allowOrigins: Cors.ALL_ORIGINS
      }
    })

    const userAuthorizer = new apigw.CfnAuthorizer(this, 'UserAuthorizer', {
      restApiId: userApi.restApiId,
      type: apigw.AuthorizationType.COGNITO,
      name: 'UserAuthorizer',
      providerArns: [userPool.userPoolArn],
      identitySource: 'method.request.header.Authorization',
      authorizerResultTtlInSeconds: 300,
      authType: 'cognito_user_pools'
    })

    const registerUser = new lambda.Function(this, 'registerUser', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'register.handler',
      code: lambda.Code.fromAsset('nodejs/lambda'),
      environment: {
        DYNAMODB_TABLE_NAME: integratorTable.tableName,
        USER_POOL_ID: userPool.userPoolId
      },
      memorySize: 1024
    })

    registerUser.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
          'cognito-idp:AdminCreateUser'
      ],
      resources: [userPool.userPoolArn]
    }))

    const registerUserResource = userApi.root.addResource('register')
    const registerUserResourceWithID = registerUserResource.addResource('{creatorID}')
    const registerUserIntegration = new apigw.LambdaIntegration(registerUser)

    registerUserResourceWithID.addMethod('POST', registerUserIntegration,{
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizer: { authorizerId: userAuthorizer.ref }
    })
    integratorTable.grantReadWriteData(registerUser)

    const userLoginResource = userApi.root.addResource('login')

    const userLogin = new lambda.Function(this, 'userLogin', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'login.handler',
      code: lambda.Code.fromAsset('nodejs/lambda'),
      environment: {
        DYNAMODB_TABLE_NAME: integratorTable.tableName,
        USER_CLIENT_ID: userPoolClient.userPoolClientId
      },
      memorySize: 1024
    })

    userLogin.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "cognito-idp:InitiateAuth",
        "cognito-idp:AdminGetUser"
      ],
      resources: [userPool.userPoolArn]
    }))

    const userLoginIntegration = new apigw.LambdaIntegration(userLogin)

    userLoginResource.addMethod('POST', userLoginIntegration)
    integratorTable.grantReadData(userLogin)

    const firstLoginResource = userApi.root.addResource('firstLogin')
    const firstLoginResourceWithID = firstLoginResource.addResource('{userID}')

    const firstLogin = new lambda.Function(this, 'firstLogin', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'firstLogin.handler',
      code: lambda.Code.fromAsset('nodejs/lambda'),
      environment: {
        USER_CLIENT_ID: userPoolClient.userPoolClientId,
        USER_POOL_ID: userPool.userPoolId
      },
      memorySize: 1024
    })

    firstLogin.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "cognito-idp:AdminRespondToAuthChallenge"
      ],
      resources: [userPool.userPoolArn]
    }))

    const firstLoginIntegration = new apigw.LambdaIntegration(firstLogin)

    firstLoginResourceWithID.addMethod('POST', firstLoginIntegration)

    const changePasswordResource = userApi.root.addResource('changePassword')
    const changePasswordResourceWithID = changePasswordResource.addResource('{userID}')

    const changePassword = new lambda.Function(this, 'changePassword', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'changePassword.handler',
      code: lambda.Code.fromAsset('nodejs/lambda'),
      environment: {
        USER_CLIENT_ID: userPoolClient.userPoolClientId
      },
      memorySize: 1024
    })

    changePassword.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
          'cognito-idp:AdminSetUserPassword'
      ],
      resources: [userPool.userPoolArn]
    }))

    const changePasswordIntegration = new apigw.LambdaIntegration(changePassword)

    changePasswordResourceWithID.addMethod('POST', changePasswordIntegration, {
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizer: { authorizerId: userAuthorizer.ref }
    })

    const getUser = new lambda.Function(this, 'getUser', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'getUser.handler',
      code: lambda.Code.fromAsset('nodejs/lambda'),
      environment: {
        DYNAMODB_TABLE_NAME: integratorTable.tableName,
      },
      memorySize: 1024
    })

    const getUserResource = userApi.root.addResource('getUser')
    const getUserResourceWithID = getUserResource.addResource('{userID}')
    const getUserIntegration = new apigw.LambdaIntegration(getUser)

    getUserResourceWithID.addMethod('GET', getUserIntegration, {
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizer: { authorizerId: userAuthorizer.ref },
      requestParameters: {
        'method.request.querystring.userID': true
      }
    })
    integratorTable.grantReadData(getUser)

    const addUserToIntegratorGroup = new lambda.Function(this, 'addUserToGroup', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'addUserToGroup.handler',
      code: lambda.Code.fromAsset('nodejs/lambda'),
      environment: {
        DYNAMODB_TABLE_NAME: integratorTable.tableName,
      },
      memorySize: 1024
    })

    integratorTable.grantReadWriteData(addUserToIntegratorGroup)

    const addUserToGroupResource = userApi.root.addResource('group')
    const addUserToGroupResourceWithID = addUserToGroupResource.addResource('{userID}')

    addUserToGroupResourceWithID.addMethod('POST', new apigw.LambdaIntegration(addUserToIntegratorGroup), {
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizer: { authorizerId: userAuthorizer.ref }
    })

    const removeUserFromGroupLambda = new lambda.Function(this, 'removeUserFromGroup', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'removeUserFromGroup.handler',
      code: lambda.Code.fromAsset('nodejs/lambda'),
      environment: {
        DYNAMODB_TABLE_NAME: integratorTable.tableName,
      },
      memorySize: 1024
    })

    integratorTable.grantReadWriteData(removeUserFromGroupLambda)

    addUserToGroupResourceWithID.addMethod('DELETE', new apigw.LambdaIntegration(removeUserFromGroupLambda), {
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizer: { authorizerId: userAuthorizer.ref }
    })

    const getWorkers = new lambda.Function(this, 'getWorkers', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'getWorkers.handler',
      code: lambda.Code.fromAsset('nodejs/lambda'),
      environment: {
        DYNAMODB_TABLE_NAME: integratorTable.tableName,
        USER_POOL_ID: userPool.userPoolId
      },
      memorySize: 1024
    })

    getWorkers.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
          'cognito-idp:ListUsers'
      ],
      resources: [
          integratorTable.tableArn,
          userPool.userPoolArn
      ]
    }))

    integratorTable.grantReadData(getWorkers)

    const getWorkersResource = userApi.root.addResource('getWorkers')
    const getWorkersResourceWithID = getWorkersResource.addResource('{userID}')

    getWorkersResourceWithID.addMethod('GET', new apigw.LambdaIntegration(getWorkers), {
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizer: { authorizerId: userAuthorizer.ref }
    })

    const editUserLambda = new lambda.Function(this, 'editUser', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'editUser.handler',
      code: lambda.Code.fromAsset('nodejs/lambda'),
      environment: {
        DYNAMODB_TABLE_NAME: integratorTable.tableName,
        USER_POOL_ID: userPool.userPoolId
      },
      memorySize: 1024
    })

    const editUserResource = userApi.root.addResource('edit')
    const editUserResourceWithID = editUserResource.addResource('{userID}')
    editUserResourceWithID.addMethod('PUT', new apigw.LambdaIntegration(editUserLambda), {
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizer: { authorizerId: userAuthorizer.ref }
    })

    integratorTable.grantReadWriteData(editUserLambda)

    editUserLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cognito-idp:AdminDisableUser',
        'cognito-idp:AdminEnableUser'
      ],
      resources: [userPool.userPoolArn]
    }))

    // End user

    // Start integrator

    const integratorApi = new apigw.RestApi(this, 'IntegratorApi', {
      restApiName: 'IntegratorAPI',
      defaultCorsPreflightOptions: {
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'Access-Control-Allow-Credentials',
          'Access-Control-Allow-Headers',
          'Impersonating-User-Sub'
        ],
        allowMethods: ['OPTIONS', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        allowCredentials: true,
        allowOrigins: Cors.ALL_ORIGINS
      },
    })

    const integratorAuthorizer = new apigw.CfnAuthorizer(this, 'KruszaraAuthorizer', {
      restApiId: integratorApi.restApiId,
      type: apigw.AuthorizationType.COGNITO,
      name: 'KruszaraAuthorizer',
      providerArns: [userPool.userPoolArn],
      identitySource: 'method.request.header.Authorization',
      authorizerResultTtlInSeconds: 300,
      authType: 'cognito_user_pools'
    })

    const integratorLambda = new lambda.Function(this, 'IntegratorLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'integrator.handler',
      code: lambda.Code.fromAsset('nodejs/lambda'),
      environment: {
        DYNAMODB_TABLE_NAME: integratorTable.tableName
      },
      memorySize: 1024
    })

    const integratorResource = integratorApi.root.addResource('integrator')
    const integratorResourceWithID = integratorResource.addResource('{userID}')

    integratorResourceWithID.addMethod('POST', new apigw.LambdaIntegration(integratorLambda), {
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizer: { authorizerId: integratorAuthorizer.ref },
    })
    integratorTable.grantReadWriteData(integratorLambda)

    const editIntegratorLambda = new lambda.Function(this, 'editIntegrator', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'editIntegrator.handler',
      code: lambda.Code.fromAsset('nodejs/lambda'),
      environment: {
        DYNAMODB_TABLE_NAME: integratorTable.tableName
      },
      memorySize: 1024
    })

    integratorResourceWithID.addMethod('PUT', new apigw.LambdaIntegration(editIntegratorLambda), {
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizer: { authorizerId: integratorAuthorizer.ref },
    })
    integratorTable.grantReadWriteData(editIntegratorLambda)

    const getIntegrators = new lambda.Function(this, 'GetIntegrators', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'getIntegrators.handler',
      code: lambda.Code.fromAsset('nodejs/lambda'),
      environment: {
        DYNAMODB_TABLE_NAME: integratorTable.tableName
      },
      memorySize: 1024
    })

    integratorResourceWithID.addMethod('GET', new apigw.LambdaIntegration(getIntegrators), {
      requestParameters: {
        'method.request.querystring.createdFor': true
      },
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizer: { authorizerId: integratorAuthorizer.ref },
    })
    integratorTable.grantReadData(getIntegrators)

    const integratorGroupLambda = new lambda.Function(this, 'IntegratorGroupLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'createIntegratorGroup.handler',
      code: lambda.Code.fromAsset('nodejs/lambda'),
      environment: {
        DYNAMODB_TABLE_NAME: integratorTable.tableName,
      },
      memorySize: 1024
    })

    const integratorGroupResource = integratorApi.root.addResource('integratorGroup')
    const integratorGroupResourceWithID = integratorGroupResource.addResource('{userID}')

    integratorGroupResourceWithID.addMethod('POST', new apigw.LambdaIntegration(integratorGroupLambda), {
        authorizationType: apigw.AuthorizationType.COGNITO,
        authorizer: { authorizerId: integratorAuthorizer.ref }
    })
    integratorTable.grantReadWriteData(integratorGroupLambda)

    const addIntegratorToGroupLambda = new lambda.Function(this, 'AddIntegratorToGroupLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'addIntegratorToGroup.handler',
      code: lambda.Code.fromAsset('nodejs/lambda'),
      environment: {
        DYNAMODB_TABLE_NAME: integratorTable.tableName,
      },
      memorySize: 1024
    })

    const addIntegratorToGroupResource = integratorGroupResourceWithID.addResource('add')

    addIntegratorToGroupResource.addMethod('POST', new apigw.LambdaIntegration(addIntegratorToGroupLambda), {
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizer: { authorizerId: integratorAuthorizer.ref }
    })
    integratorTable.grantReadWriteData(addIntegratorToGroupLambda)

    const removeIntegratorFromGroupLambda = new lambda.Function(this, 'removeIntegratorFromGroup', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'removeIntegratorFromGroup.handler',
      code: lambda.Code.fromAsset('nodejs/lambda'),
      environment: {
        DYNAMODB_TABLE_NAME: integratorTable.tableName,
      },
      memorySize: 1024
    })

    const removeIntegratorFromGroupResource = integratorGroupResourceWithID.addResource('remove')

    removeIntegratorFromGroupResource.addMethod('DELETE', new apigw.LambdaIntegration(removeIntegratorFromGroupLambda), {
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizer: { authorizerId: integratorAuthorizer.ref }
    })
    integratorTable.grantReadWriteData(removeIntegratorFromGroupLambda)

    const getIntegratorGroupsLambda = new lambda.Function(this, 'GetIntegratorGroups', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'getIntegratorGroups.handler',
      code: lambda.Code.fromAsset('nodejs/lambda'),
      environment: {
        DYNAMODB_TABLE_NAME: integratorTable.tableName,
      },
      memorySize: 1024
    })

    integratorGroupResourceWithID.addMethod('GET', new apigw.LambdaIntegration(getIntegratorGroupsLambda), {
      requestParameters: {
        'method.request.querystring.groupsFor': true
      },
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizer: { authorizerId: integratorAuthorizer.ref },
    })

    integratorTable.grantReadData(getIntegratorGroupsLambda)

    const editIntegratorGroupLambda = new lambda.Function(this, 'EditGroup', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'editGroup.handler',
      code: lambda.Code.fromAsset('nodejs/lambda'),
      environment: {
        DYNAMODB_TABLE_NAME: integratorTable.tableName,
      },
      memorySize: 1024
    })

    integratorGroupResourceWithID.addMethod('PUT', new apigw.LambdaIntegration(editIntegratorGroupLambda), {
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizer: { authorizerId: integratorAuthorizer.ref },
    })

    integratorTable.grantReadWriteData(editIntegratorGroupLambda)

    const getIntegratorsFromGroups = new lambda.Function(this, 'getIntegratorsFromGroups', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'getIntegratorsFromGroups.handler',
      code: lambda.Code.fromAsset('nodejs/lambda'),
      environment: {
        DYNAMODB_TABLE_NAME: integratorTable.tableName,
      },
      memorySize: 1024
    })

    const getIntegratorsFromGroupsResource = integratorGroupResourceWithID.addResource('fromGroups')

    getIntegratorsFromGroupsResource.addMethod('GET', new apigw.LambdaIntegration(getIntegratorsFromGroups), {
      requestParameters: {
        'method.request.querystring.groupsFor': true,
        'method.request.querystring.groups': true
      },
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizer: { authorizerId: integratorAuthorizer.ref },
    })
    integratorTable.grantReadData(getIntegratorsFromGroups)

    const integratorEntryLambda = new lambda.Function(this, 'IntegratorEntryLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'createIntegratorEntry.handler',
      code: lambda.Code.fromAsset('nodejs/lambda'),
      environment: {
        DYNAMODB_TABLE_NAME: integratorTable.tableName,
      },
      memorySize: 1024
    })

    const integratorEntryResource = integratorApi.root.addResource('integratorEntry')
    const integratorEntryResourceWithID = integratorEntryResource.addResource('{userID}')
    integratorEntryResourceWithID.addMethod('POST', new apigw.LambdaIntegration(integratorEntryLambda), {
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizer: { authorizerId: integratorAuthorizer.ref }
    })

    integratorTable.grantReadWriteData(integratorEntryLambda);

    const reportLambda = new lambda.Function(this, 'CreateReport', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'createReport.handler',
      code: lambda.Code.fromAsset('nodejs/lambda'),
      environment: {
        DYNAMODB_TABLE_NAME: integratorTable.tableName,
        BUCKET: s3ReportsBucket.bucketName
      },
      memorySize: 1024
    })

    const reportResource = integratorApi.root.addResource('report')
    const reportResourceWithID = reportResource.addResource('{requesterID}')
    reportResourceWithID.addMethod('POST', new apigw.LambdaIntegration(reportLambda), {
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizer: { authorizerId: integratorAuthorizer.ref },
      requestParameters: {
        'method.request.querystring.managerID': true,
      }
    })

    s3ReportsBucket.grantPut(reportLambda)
    integratorTable.grantReadWriteData(reportLambda)

    const getAllReportsLambda = new lambda.Function(this, 'GetAllReports', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'getAllReports.handler',
      code: lambda.Code.fromAsset('nodejs/lambda'),
      environment: {
        DYNAMODB_TABLE_NAME: integratorTable.tableName,
      },
      memorySize: 1024
    })

    const allReportsResource = reportResourceWithID.addResource('all')
    allReportsResource.addMethod('GET', new apigw.LambdaIntegration(getAllReportsLambda), {
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizer: { authorizerId: integratorAuthorizer.ref }
    })

    integratorTable.grantReadData(getAllReportsLambda)

    const getReportLambda = new lambda.Function(this, 'GetReport', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'getReportFromS3.handler',
      code: lambda.Code.fromAsset('nodejs/lambda'),
      environment: {
        DYNAMODB_TABLE_NAME: integratorTable.tableName,
        BUCKET: s3ReportsBucket.bucketName
      },
      memorySize: 1024
    })

    reportResourceWithID.addMethod('GET', new apigw.LambdaIntegration(getReportLambda), {
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizer: { authorizerId: integratorAuthorizer.ref },
      requestParameters: {
        'method.request.querystring.reportID': true,
      }
    })

    integratorTable.grantReadData(getReportLambda)
    s3ReportsBucket.grantRead(getReportLambda)
  }
}
