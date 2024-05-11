import {IUser} from "../Interfaces/IUser";
import {Integrator} from "../Interfaces/IIntegrator";
import {IntegratorGroup} from "../Interfaces/IIntegratorGroup";
import {IntegratorEntry} from "../Interfaces/IIntegratorEntry";
import {ICognitoUser} from "../Interfaces/ICognitoUser";
import {IRegisterUser} from "../Interfaces/IRegisterUser";
import {ILoginResponse} from "../Interfaces/ILoginResponse";
import {CognitoAttributes} from "../Enums/CognitoAttributes";
import {
    BatchGetItemCommand,
    BatchGetItemCommandInput, BatchWriteItemCommand,
    DynamoDBClient,
    GetItemCommand,
    GetItemCommandInput, PutItemCommand, PutItemCommandInput,
    QueryCommand,
    QueryCommandInput, UpdateItemCommand, UpdateItemCommandInput,
    BatchWriteItemCommandInput
} from "@aws-sdk/client-dynamodb";
import {unmarshall} from "@aws-sdk/util-dynamodb"
import {
    AdminCreateUserCommandInput,
    AdminDisableUserCommandInput,
    AdminEnableUserCommandInput,
    AdminSetUserPasswordCommand,
    AttributeType,
    CognitoIdentityProvider,
    GetUserCommand,
    InitiateAuthCommandInput,
    ListUsersCommand,
    ListUsersCommandInput
} from "@aws-sdk/client-cognito-identity-provider"
import {IFunctionError} from "../Interfaces/IFunctionError";
import {ICognitoChallengeLoginResponse} from "../Interfaces/ICognitoChallengeLoginResponse";
import {IGetRelationResponse} from "../Interfaces/IGetRelationResponse";
import {IFunctionSuccess} from "../Interfaces/IFunctionSuccess";
import {IGetIntegratorsFromGroupsResponse} from "../Interfaces/IGetIntegratorsFromGroupsResponse";
import {IReportData} from "../Interfaces/IReportData";
import {IntegratorStatus} from "../Enums/IntegratorStatus";
import {IEntriesToGet} from "../Interfaces/IEntriesToGet";
import {GetObjectCommand, PutObjectCommand, S3Client} from "@aws-sdk/client-s3";
import {IEditUser} from "../Interfaces/IEditUser";
import {IEditIntegrator} from "../Interfaces/IEditIntegrator";
import {IEditGroup} from "../Interfaces/IEditGroup";

const crypto = require('crypto')

const dynamoDB = new DynamoDBClient()

const cognitoIdentityProvider = new CognitoIdentityProvider()

const s3Client = new S3Client()

export const generateId = (): string => {
    return crypto.randomBytes(16).toString('hex')
}

export const getUserByID = async (userID: string): Promise<IUser> => {
    const params: GetItemCommandInput = {
        TableName: process.env.DYNAMODB_TABLE_NAME || '',
        Key: {
            PK: { S: userID },
            SK: { S: 'user'}
        }
    }
    try {
        const getUserCommand = new GetItemCommand(params);
        const result = await dynamoDB.send(getUserCommand)

        if (result.Item) {
            return unmarshall(result.Item) as IUser
        }
        throw new Error('Error getting user')

    }
    catch (e) {
        console.error('Error getting user: ', e);
        throw e;
    }
}

export const createUser = async (user: IRegisterUser, creatorID: string): Promise<IUser | IFunctionError> => {
    try {
        const creator = await getUserByID(creatorID)

        const table = process.env.DYNAMODB_TABLE_NAME || ''

        const userRoles = {
            isService: false,
            isManager: false
        }

        const { username, userAttributes, role, manager }: IRegisterUser = user

        if(!username) {
            return {
                error: 'Missing username',
                code: 400
            }
        }

        if (role) {
            userRoles.isService = role?.isService || false
            userRoles.isManager = role?.isManager || false
        }

        if(!creator.role.isManager && !creator.role.isService){ // worker tries to create a user
            return {
                error: 'Worker cannot create users',
                code: 403
            }
        }

        else if(!creator.role.isService && (role?.isService || role?.isManager)){ // manager tries to create another manager or service user
            return {
                error: 'Manager cannot create a manager or service user',
                code: 403
            }
        }

        else if(creator.role.isService && !role?.isService && !role?.isManager && !manager){ // service user tries to create a worker without a manager
            return {
                error: 'The worker must have a manager',
                code: 400
            }
        }

        else if(creator.role.isService && !role?.isService && role?.isManager && manager){ // service user tries to assign a manager to a manager
            return {
                error: 'The manager cannot have a manager',
                code: 400
            }
        }

        else if(creator.role.isService && !role?.isService && !role?.isManager && manager){ // service user tries to assign a non-existing manager
            const managerExists = await getUserByID(manager)
            if(!managerExists || !managerExists?.role.isManager)
            return {
                error: "There isn't a manager with this ID",
                code: 400
            }
        }

        else if(creator.role.isService && role?.isService && manager){ // service user tries to create a service user with a manager
            return {
                error: "There isn't a manager with this ID",
                code: 400
            }
        }

        else if(creator.role.isService && role?.isService && role?.isManager){ // service user tries to create a service user that is also a manager
            return {
                error: "A service user cannot also be a manager",
                code: 400
            }
        }

        else if(!creator.role.isService && manager !== creatorID) { // manager tries to create a user for another manager
            return {
                error: 'The manager cannot create users for other managers',
                code: 403
            }
        }

        if(userAttributes!.length === 0 || !userAttributes){
            return {
                error: 'userAttributes cannot be empty',
                code: 400
            }
        }

        if(userAttributes.find(attr => attr.Name === CognitoAttributes.EMAIL && attr.Value !== username)){
            return {
                error: 'username and email do not match',
                code: 400
            }
        }



        const cognitoParams: ICognitoUser = {
            userPoolId: process.env.USER_POOL_ID || '',
            username: username,
            userAttributes: userAttributes
        }

        const adminCreateUserParams: AdminCreateUserCommandInput = {
            UserPoolId: cognitoParams.userPoolId,
            Username: cognitoParams.username,
            UserAttributes: cognitoParams.userAttributes,
        };
        const createUserResponse = await cognitoIdentityProvider.adminCreateUser(adminCreateUserParams)
        if(createUserResponse.User?.Attributes){
            const userID = createUserResponse.User.Attributes.find(attr => attr.Name === 'sub')?.Value || 'Not found in cognito';
            const userParams: IUser = {
                PK: userID,
                role: userRoles,
                cognitoAttributes: cognitoParams.userAttributes!
            };

            const item: Record<string, any> = {
                PK: { S: userParams.PK },
                SK: { S: 'user'},
                role: {
                    M: {
                        isService: { BOOL: userRoles.isService },
                        isManager: { BOOL: userRoles.isManager }
                    }
                },
                cognitoAttributes: {
                    L: userParams.cognitoAttributes.map(attr => ({
                        M: {
                            Name: { S: attr.Name },
                            Value: { S: attr.Value }
                        }
                    }))
                }
            };

            const params: BatchWriteItemCommandInput = {
                RequestItems: {
                    [table]: [
                        {
                            PutRequest: {
                                Item: item
                            }
                        },
                        {
                            PutRequest: {
                                Item: {
                                    PK: { S: manager },
                                    SK: { S: `user#${userParams.PK}`}
                                }
                            }
                        }
                    ]
                }
            }
            const batchWriteItemCommand = new BatchWriteItemCommand(params)

            await dynamoDB.send(batchWriteItemCommand)

            return userParams
        }
        return { error: 'No user attributes found in the response', code: 500 };
    }
    catch (e) {
        return {
            error: 'Error in createUser function: ' + e,
            code: 500
        }
    }
}

export const userLogin = async ({username, password}: {username: string, password: string}): Promise<ILoginResponse | ICognitoChallengeLoginResponse | IFunctionError> => {
    const cognitoParams: InitiateAuthCommandInput = {
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: process.env.USER_CLIENT_ID || '',
        AuthParameters: {
            USERNAME: username,
            PASSWORD: password,
        }
    }
    try {
        const authenticationResult = await cognitoIdentityProvider.initiateAuth(cognitoParams)

        if (!authenticationResult) {
            return { error: 'could not get auth result', code: 500 };
        }

        const { ChallengeName, ChallengeParameters, Session } = authenticationResult

        if(ChallengeName && ChallengeParameters && Session){
            return {
                challengeName: ChallengeName,
                challengeParameters: ChallengeParameters,
                session: Session
            }
        }

        else if(authenticationResult.AuthenticationResult){

            const { AccessToken , IdToken} = authenticationResult.AuthenticationResult

            if(AccessToken && IdToken){

                const userAttributes = await getUserAttributesFromCognito(AccessToken)

                const subAttribute = userAttributes.find(attr => attr.Name === 'sub')

                if(subAttribute && subAttribute.Value){
                    return {
                        sub: subAttribute.Value,
                        id_token: IdToken,
                        access_token: AccessToken,
                    }
                }
                return {error: 'Could not get sub', code: 500}
            }
            return {error: 'Could not get AccessToken or IdToken', code: 500}
        }
        return {error: 'Could not get response from cognito: ' + JSON.stringify(authenticationResult, null, 2), code: 500}
    }
    catch (e) {
        return {error: 'Could not get response from cognito: ' + e, code: 500}
    }
}

const getUserAttributesFromCognito = async (accessToken: string): Promise<AttributeType[]> => {
    const params = {
        AccessToken: accessToken
    };
    try {
        const getUserCommand = new GetUserCommand(params)
        const userData = await cognitoIdentityProvider.send(getUserCommand);
        return userData.UserAttributes || [];
    }
    catch (e) {
        console.error('Error getting user attributes from Cognito: ' + e);
        return [];
    }
}

export const changeUserPassword = async (username: string, newPassword: string): Promise<IFunctionSuccess | IFunctionError> => {
    try {
        await cognitoIdentityProvider.send(
            new AdminSetUserPasswordCommand({
                UserPoolId: process.env.USER_POOL_ID || '',
                Username: username,
                Password: newPassword,
                Permanent: true,
            })
        );
        return {success: username}
    } catch (e) {
        console.error('Error changing password:', e);
        return {error: 'Error changing password: ' + e, code: 500}
    }
}

export const respondToNewPwdCognitoChallenge = async (newPassword: string, username: string, session: string): Promise<ILoginResponse | IFunctionError> => {
    try {
        const authChallengeResponse = await cognitoIdentityProvider.respondToAuthChallenge({
            ChallengeName: "NEW_PASSWORD_REQUIRED",
            ChallengeResponses: {
                NEW_PASSWORD: newPassword,
                USERNAME: username
            },
            ClientId: process.env.USER_CLIENT_ID || '',
            Session: session
        })

        if(authChallengeResponse.AuthenticationResult){
            const { AccessToken , IdToken} = authChallengeResponse.AuthenticationResult

            if(AccessToken && IdToken){

                const userAttributes = await getUserAttributesFromCognito(AccessToken)

                const subAttribute = userAttributes.find(attr => attr.Name === 'sub')

                if(subAttribute && subAttribute.Value){
                    return {
                        sub: subAttribute.Value,
                        id_token: IdToken,
                        access_token: AccessToken,
                    }
                }
                return {error: 'Could not get sub', code: 500}
            }
            return {error: 'Could not get AccessToken or IdToken', code: 500}
        }
        return {error: 'Could not get response from cognito: ' + JSON.stringify(authChallengeResponse, null, 2), code: 500}
    }
    catch (e) {
        console.error('Error completing challenge: ', e)
        return {error: 'Error completing challenge: ' + e, code: 500}
    }

}

export const getUserInfo = async (userID: string, requesterID: string): Promise<IUser | IFunctionError> => {
    try {
        const requester: IUser = await getUserByID(requesterID)

        if(!requester.role.isService && !requester.role.isManager){
            return { error: 'Requester is neither a service user nor a manager', code: 403 }
        }
        if(requester.role.isManager && userID !== requesterID){
            const worker = await getWorker(requesterID, requesterID, userID)
            if('error' in worker){
                console.error('Error in worker: ' + worker.error)
                return { error: 'Error in worker: ' + worker.error, code: worker.code }
            }
        }
        return await getUserByID(userID)
    }
    catch (e) {
        console.error('Error in getUserInfo function: ' + e)
        return { error: 'Error in getUserInfo function: ' + e, code: 500 }
    }
}

export const getWorkers = async (userID: string): Promise<IUser[] | IFunctionError> => {
    try {
        const user = await getUserByID(userID)

        const table = process.env.DYNAMODB_TABLE_NAME || ''

        const userPool = process.env.USER_POOL_ID || ''


        if(user.role?.isService) {
            const cognitoParams: ListUsersCommandInput = {
                UserPoolId: userPool
            }

            const cognitoUsers = await cognitoIdentityProvider.send(new ListUsersCommand(cognitoParams))

            if(cognitoUsers.Users && cognitoUsers.Users.length > 0){
                const mappedUsers = cognitoUsers.Users.map(user => ({ PK: { S: user.Username! }, SK: { S: 'user' } }))
                const params: BatchGetItemCommandInput = {
                    RequestItems: {
                        [table]: {
                            Keys: mappedUsers
                        }
                    }
                }
                const batchItemGetCommand = new BatchGetItemCommand(params)
                const result = await dynamoDB.send(batchItemGetCommand)

                if(result.Responses && result.Responses[table] ){
                    return result.Responses[table].map(item => unmarshall(item) as IUser);
                }
                return {error: 'could not get Responses', code: 500}
            }
            return {error: 'could not get users', code: 500}
        }
        else if(user.role?.isManager){
            const params: QueryCommandInput = {
                TableName: table,
                KeyConditionExpression: 'PK = :pk and begins_with(SK, :sk)',
                ExpressionAttributeValues: {
                    ':pk': { S: userID },
                    ':sk': { S: 'user#'}
                }
            }
            const queryCommand = new QueryCommand(params)
            const result = await dynamoDB.send(queryCommand)

            if(result.Items){
                const userKeys = result.Items.map(item => {
                    return { PK: { S: unmarshall(item).SK.substring(5) }, SK: { S: 'user' } }
                })
                const batchGetItemsParams: BatchGetItemCommandInput = {
                    RequestItems: {
                        [table]: {
                            Keys: userKeys
                        }
                    }
                }
                const batchGetItem = new BatchGetItemCommand(batchGetItemsParams)
                const batchGetItemResult = await dynamoDB.send(batchGetItem)

                if(batchGetItemResult.Responses && batchGetItemResult.Responses[table] ){
                    return batchGetItemResult.Responses[table].map(item => unmarshall(item) as IUser);
                }
                return {error: `Could not get batchGetItemResult.Responses for ${user.PK}`, code: 500}
            }
            return {error: `Could not get result.Items for ${user.PK}`, code: 500}
        }
        return {error: 'User is neither a service user nor a manager', code: 403}
    }
    catch (e) {
        console.error(`Error getting workers: ${e}`)
        return {error: `Error getting workers: ${e}`, code: 500}
    }
}

export const getWorker = async (userID: string, managerID: string, workerID: string): Promise<IGetRelationResponse | IFunctionError> => {
    try {
        const table = process.env.DYNAMODB_TABLE_NAME || ''

        const user = await getUserByID(userID)

        if(user.role.isManager || user.role.isService){

            if(user.role.isManager) managerID = userID

            const getWorkerCommandInput: GetItemCommandInput = {
                TableName: table,
                Key: {
                    PK: { S: managerID },
                    SK: { S: `user#${workerID}`}
                }
            }
            const getWorkerCommand = new GetItemCommand(getWorkerCommandInput)

            const worker = await dynamoDB.send(getWorkerCommand)

            if(worker?.Item){
                return unmarshall(worker.Item) as IGetRelationResponse
            }
            return {error: 'Manager does not have a worker with this id: ' + workerID, code: 400}
        }
        return {error: 'User is neither a service user nor a manager', code: 403}
    }
    catch (e) {
        console.error('Error in getWorker function: ' + e)
        return { error: 'Error in getWorker function: ' + e, code: 500 }
    }
}

export const createIntegrator = async({location, serialNumber, userID, creatorID}: {location: string, serialNumber: string, userID: string, creatorID: string}):Promise<Integrator| IFunctionError> => {
    try {
        const user = await getUserByID(creatorID)

        const manager = await getUserByID(userID)

        const table = process.env.DYNAMODB_TABLE_NAME || ''

        if(!user.role.isManager && !user.role.isService && !manager.role.isManager) return {error: `User is neither a service user nor a manager`, code: 403}

        const integratorID = generateId()

        const item: Record<string, any> = {
            PK: { S: integratorID },
            SK: { S: 'integrator' },
            location: { S: location },
            serialNumber: { S: serialNumber },
            status: { N: IntegratorStatus.ON }
        }

        if(location && serialNumber && userID) {
            const createIntegratorInput: BatchWriteItemCommandInput = {
                RequestItems: {
                    [table]: [
                        {
                            PutRequest: {
                                Item: item
                            }
                        },
                        {
                            PutRequest: {
                                Item: {
                                    PK: {S: userID},
                                    SK: {S: `integrator#${integratorID}`}
                                }
                            }
                        }
                    ]
                }
            }

            const createIntegratorCommand = new BatchWriteItemCommand(createIntegratorInput)

            await dynamoDB.send(createIntegratorCommand)

            return unmarshall(item) as Integrator

        }
        return {error: 'Missing params', code: 400}
    }
    catch (e) {
        console.error('Error in createIntegrator function: ', e)
        return {error: `Error in createIntegrator function: ${e}`, code: 500}
    }
}

export const getIntegrators = async (userID: string, integratorOwnerID: string): Promise<Integrator[] | IFunctionError> => {
    try {
        if(!userID) return {error: 'No userID', code: 400}

        const user = await getUserByID(userID)

        const table = process.env.DYNAMODB_TABLE_NAME || ''

        if(!user.role.isService) {
            integratorOwnerID = userID
        }

        const getIntegratorsForManagerParams: QueryCommandInput = {
            TableName: table,
            KeyConditionExpression: 'PK = :pk and begins_with(SK, :sk)',
            ExpressionAttributeValues: {
                ':pk': { S: integratorOwnerID },
                ':sk': { S: 'integrator#'}
            }
        }

        const getIntegratorsForManagerCommand = new QueryCommand(getIntegratorsForManagerParams)

        const result = await dynamoDB.send(getIntegratorsForManagerCommand)

        if(result.Items){
            const integratorKeys = result.Items.map(item => {
                return { PK: { S: unmarshall(item).SK.substring(11) }, SK: { S: 'integrator' } }
            })

            const getIntegratorsParamas: BatchGetItemCommandInput = {
                RequestItems: {
                    [table]: {
                        Keys: integratorKeys
                    }
                }
            }

            const getIntegratorsCommand = new BatchGetItemCommand(getIntegratorsParamas)

            const getIntegratorsResult = await dynamoDB.send(getIntegratorsCommand)

            if(getIntegratorsResult.Responses && getIntegratorsResult.Responses[table] ){
                return getIntegratorsResult.Responses[table].map(item => unmarshall(item) as Integrator);
            }
            return {error: `Could not get batchGetItemResult.Responses for ${integratorOwnerID}`, code: 500}
        }
        return {error: 'No result.Items', code: 500}
    }
    catch (e) {
        console.error('Error in getIntegrators function: ' + e)
        return { error: 'Error in getIntegrators function: ' + e, code: 500 }
    }
}

export const getIntegrator = async (userID: string, managerID: string, integratorID: string): Promise<IGetRelationResponse | IFunctionError> => {
    try {
        const table = process.env.DYNAMODB_TABLE_NAME || ''

        const user = await getUserByID(userID)

        if(user.role.isManager || user.role.isService){

            if(user.role.isManager) managerID = userID

            const getIntegratorCommandInput: GetItemCommandInput = {
                TableName: table,
                Key: {
                    PK: { S: managerID },
                    SK: { S: `integrator#${integratorID}`}
                }
            }
            const getIntegratorCommand = new GetItemCommand(getIntegratorCommandInput)

            const integrator = await dynamoDB.send(getIntegratorCommand)

            if(integrator?.Item){
                return unmarshall(integrator.Item) as IGetRelationResponse
            }
            return {error: 'Manager does not have an integrator with this id: ' + integratorID, code: 400}
        }
        return {error: 'User is neither a service user nor a manager', code: 403}
    }
    catch (e) {
        console.error('Error in getIntegrator function: ' + e)
        return { error: 'Error in getIntegrator function: ' + e, code: 500 }
    }
}

export const addUserToIntegratorGroup = async (integratorGroupID: string, userID: string, managerID: string, addedUserID: string): Promise<IGetRelationResponse | IFunctionError> => {
    try {
        const table = process.env.DYNAMODB_TABLE_NAME || ''

        const managerHasWorkerWithID = await getWorker(userID, managerID, addedUserID)

        if('error' in managerHasWorkerWithID){
            console.error('Error in managerHasWorkerWithID: ' + managerHasWorkerWithID.error)
            return { error: 'Error in managerHasWorkerWithID: ' + managerHasWorkerWithID.error, code: managerHasWorkerWithID.code }
        }

        const managerHasGroupWithID = await getIntegratorGroup(userID, managerID, integratorGroupID)

        if('error' in managerHasGroupWithID){
            console.error('Error in managerHasGroupWithID: ' + managerHasGroupWithID.error)
            return { error: 'Error in managerHasGroupWithID: ' + managerHasGroupWithID.error, code: managerHasGroupWithID.code }
        }

        const userAlreadyInGroup = await checkIfUserIsInGroup(integratorGroupID, userID)

        if('error' in userAlreadyInGroup){
            console.error('Error in userAlreadyInGroup: ' + userAlreadyInGroup.error)
            return { error: 'Error in userAlreadyInGroup: ' + userAlreadyInGroup.error, code: userAlreadyInGroup.code }
        }
        else if('isDeleted' in userAlreadyInGroup){
            const updateGroupRelationParams: UpdateItemCommandInput = {
                TableName: table,
                ExpressionAttributeValues: {
                    ':isDeleted': {BOOL: false }
                },
                Key: {
                    'PK': { S: addedUserID },
                    'SK': { S: `group#${integratorGroupID}` }
                },
                ReturnValues: "ALL_NEW",
                UpdateExpression: "SET isDeleted = :isDeleted"
            }
            const updateCommand = new UpdateItemCommand(updateGroupRelationParams)
            const query = await dynamoDB.send(updateCommand)
            if(query.Attributes){
                return unmarshall(query.Attributes) as IGetRelationResponse
            }
            console.error('Could not update the item')
            return {error: 'Could not update the item', code: 500}
        }
        else if('success' in userAlreadyInGroup){
            const item: Record<string, any> = {
                PK: { S: addedUserID},
                SK: { S: `group#${integratorGroupID}`}
            }

            const addUserToGroupInput: PutItemCommandInput = {
                TableName: table,
                Item: item
            }

            const addUserToGroupCommand = new PutItemCommand(addUserToGroupInput)

            await dynamoDB.send(addUserToGroupCommand)

            return { PK : addedUserID, SK: `group#${integratorGroupID}`}
        }
        return { error: 'User already in group', code: 400 }
    }
    catch (e) {
        console.error("Error adding user to group" + e)
        return { error: "Error adding user to group" + e, code: 500}
    }
}

export const checkIfUserIsInGroup = async (integratorGroupID: string, userID: string): Promise<IFunctionSuccess | IFunctionError | IGetRelationResponse> => {
    try {
        const table = process.env.DYNAMODB_TABLE_NAME || ''

        const getUserInGroupCommandInput: GetItemCommandInput = {
            TableName: table,
            Key: {
                PK: { S: userID },
                SK: { S: `group#${integratorGroupID}`}
            }
        }
        const getUserInGroupCommand = new GetItemCommand(getUserInGroupCommandInput)

        const userInGroup = await dynamoDB.send(getUserInGroupCommand)

        if(userInGroup?.Item){
            return unmarshall(userInGroup.Item) as IGetRelationResponse
        }
        return { success: `User ${userID} not in group ${integratorGroupID}` }
    }
    catch (e) {
        console.error('Error in checkIfIntegratorIsInGroup function: ' + e)
        return { error: 'Error in checkIfIntegratorIsInGroup function: ' + e, code: 500 }
    }
}

export const createIntegratorGroup = async (integratorGroupName: string, creatorID: string, userID: string): Promise<IntegratorGroup | IFunctionError> => {
   try {
       const integratorGroupID = generateId()

       const table = process.env.DYNAMODB_TABLE_NAME || ''

       const item: Record<string, any> = {
           PK: { S: integratorGroupID },
           SK: { S: 'group'},
           integratorGroupName: { S: integratorGroupName },
       }

       const creator = await getUserByID(creatorID)

       if(!creator.role.isService && !creator.role.isManager) {
           return {error: 'User is neither a service user nor a manager', code: 403}
       }

       if(creator.role.isManager) userID = creatorID

       else {
           const manager = await getUserByID(userID)

           if(!manager.role.isManager){
               return { error: 'Cannot add an integrator group for a non manager', code: 400 }
           }
       }

       const createIntegratorGroupRequest: BatchWriteItemCommandInput = {
           RequestItems: {
               [table]: [
                   {
                       PutRequest: {
                           Item: item
                       }
                   },
                   {
                       PutRequest: {
                           Item: {
                               PK: { S: userID },
                               SK: { S: `group#${integratorGroupID}`}
                           }
                       }
                   }
               ]
           }
       }

       const batchWriteItemCommand = new BatchWriteItemCommand(createIntegratorGroupRequest)

       await dynamoDB.send(batchWriteItemCommand)

       return unmarshall(item)
   }
   catch (e) {
       console.error('Error in createIntegratorGroup function: ' + e)
       return { error: 'Error in createIntegratorGroup function: ' + e, code: 500 }

   }
}

export const addIntegratorToGroup = async (integratorGroupID: string, userID: string, managerID: string, integratorID: string): Promise<IGetRelationResponse | IFunctionError> => {
    try {
        const table = process.env.DYNAMODB_TABLE_NAME || ''

        const managerHasIntegratorWithID = await getIntegrator(userID, managerID, integratorID)

        if('error' in managerHasIntegratorWithID){
            console.error('Error in managerHasIntegratorWithID: ' + managerHasIntegratorWithID.error)
            return { error: 'Error in managerHasIntegratorWithID: ' + managerHasIntegratorWithID.error, code: managerHasIntegratorWithID.code }
        }

        const managerHasGroupWithID = await getIntegratorGroup(userID, managerID, integratorGroupID)

        if('error' in managerHasGroupWithID){
            console.error('Error in managerHasGroupWithID: ' + managerHasGroupWithID.error)
            return { error: 'Error in managerHasGroupWithID: ' + managerHasGroupWithID.error, code: managerHasGroupWithID.code }
        }

        const integratorAlreadyInGroup = await checkIfIntegratorIsInGroup(integratorGroupID, integratorID)

        if('error' in integratorAlreadyInGroup){
            console.error('Error in integratorAlreadyInGroup: ' + integratorAlreadyInGroup.error)
            return { error: 'Error in integratorAlreadyInGroup: ' + integratorAlreadyInGroup.error, code: integratorAlreadyInGroup.code }
        }
        else if('isDeleted' in integratorAlreadyInGroup){
            const updateGroupRelationParams: UpdateItemCommandInput = {
                TableName: table,
                ExpressionAttributeValues: {
                    ':isDeleted': {BOOL: false }
                },
                Key: {
                    'PK': { S: integratorGroupID },
                    'SK': { S: `integrator#${integratorID}` }
                },
                ReturnValues: "ALL_NEW",
                UpdateExpression: "SET isDeleted = :isDeleted"
            }
            const updateCommand = new UpdateItemCommand(updateGroupRelationParams)
            const query = await dynamoDB.send(updateCommand)
            if(query.Attributes){
                return unmarshall(query.Attributes) as IGetRelationResponse
            }
            console.error('Could not update the item')
            return {error: 'Could not update the item', code: 500}
        }
        else if('success' in integratorAlreadyInGroup){
            const item: Record<string, any> = {
                PK: { S: integratorGroupID},
                SK: { S: `integrator#${integratorID}`}
            }

            const addIntegratorToGroupInput: PutItemCommandInput = {
                TableName: table,
                Item: item
            }

            const addIntegratorToGroupCommand = new PutItemCommand(addIntegratorToGroupInput)

            await dynamoDB.send(addIntegratorToGroupCommand)

            return { PK : integratorGroupID, SK: `integrator#${integratorID}`}
        }
        return { error: 'Integrator already in group', code: 400 }
    }
    catch (e) {
        console.error('Error in addIntegratorToGroup function: ' + e)
        return { error: 'Error in addIntegratorToGroup function: ' + e, code: 500 }
    }
}

export const getIntegratorGroups = async (userID: string, requesterID: string): Promise<IntegratorGroup[] | IFunctionError> => {
    try {
        const table = process.env.DYNAMODB_TABLE_NAME || ''

        const requester = await getUserByID(requesterID)

        if(!userID || (!requester.role.isService && !requester.role.isManager)) userID = requesterID

        else if(requester.role.isManager && userID && requester.PK !== userID) {
            const worker = await getWorker(requesterID, requesterID, userID)
            if('error' in worker){
                return {error: 'Error getting worker: ' + worker.error, code: worker.code}
            }
        }

        const getGroupsForUserParams: QueryCommandInput = {
            TableName: table,
            KeyConditionExpression: 'PK = :pk and begins_with(SK, :sk)',
            ExpressionAttributeValues: {
                ':pk': { S: userID },
                ':sk': { S: 'group#'}
            }
        }

        const getGroupsForUserCommand = new QueryCommand(getGroupsForUserParams)

        const result = await dynamoDB.send(getGroupsForUserCommand)

        if(result.Items){
            const groupKeys = result.Items.map(item => {
                return { PK: { S: unmarshall(item).SK.substring(6) }, SK: { S: 'group' } }
            })

            const getGroupsParamas: BatchGetItemCommandInput = {
                RequestItems: {
                    [table]: {
                        Keys: groupKeys
                    }
                }
            }

            const getGroupsCommand = new BatchGetItemCommand(getGroupsParamas)

            const getGroupsResult = await dynamoDB.send(getGroupsCommand)

            if(getGroupsResult.Responses && getGroupsResult.Responses[table] ){
                return getGroupsResult.Responses[table].map(item => unmarshall(item) as IntegratorGroup);
            }
            return {error: `Could not get batchGetItemResult.Responses for ${userID}`, code: 500}
        }
        return {error: 'No result.Items', code: 500}
    }
    catch (e) {
        console.error('Error in getIntegratorGroups function: ' + e)
        return { error: 'Error in getIntegratorGroups function: ' + e, code: 500 }
    }
}

export const getIntegratorGroup = async (userID: string, managerID: string, integratorGroupID: string): Promise<IGetRelationResponse | IFunctionError> => {
    try {
        const table = process.env.DYNAMODB_TABLE_NAME || ''

        const user = await getUserByID(userID)

        if(user.role.isManager || user.role.isService){

            if(user.role.isManager) managerID = userID

            const getIntegratorCommandInput: GetItemCommandInput = {
                TableName: table,
                Key: {
                    PK: { S: managerID },
                    SK: { S: `group#${integratorGroupID}`}
                }
            }
            const getIntegratorCommand = new GetItemCommand(getIntegratorCommandInput)

            const group = await dynamoDB.send(getIntegratorCommand)

            if(group?.Item){
                return unmarshall(group.Item) as IGetRelationResponse
            }
            return { error: 'Manager does not have an integrator group with this id: ' + integratorGroupID, code: 400}
        }
        return { error: 'User is neither a service user nor a manager', code: 403 }
    }
    catch (e) {
        console.error('Error in getIntegratorGroup function: ' + e)
        return { error: 'Error in getIntegratorGroup function: ' + e, code: 500 }
    }
}

export const getIntegratorsFromGroups = async (requesterID: string, userID: string, integratorGroups: string[]): Promise<IGetIntegratorsFromGroupsResponse[] | IFunctionError> => {
    try {
        const table = process.env.DYNAMODB_TABLE_NAME || ''

        const requester = await getUserByID(requesterID)
        if(!userID || (!requester.role.isService && !requester.role.isManager)) userID = requesterID
        else {
            if (requester.role.isManager && requester.PK !== userID) {
                const worker = await getWorker(requesterID, requesterID, userID)
                if('error' in worker) {
                    return {error: 'Error getting worker: ' + worker.error, code: worker.code}
                }
            }
        }

        const userGroups = await getIntegratorGroups(userID, requesterID)

        if ('error' in userGroups) {
            return {error: 'Error getting userGroups: ' + userGroups.error, code: userGroups.code}
        }

        const mappedUserGroups = userGroups.map(group => group.PK)
        const integratorGroupsKeys: IGetRelationResponse[] = []

        for (const group of integratorGroups){

            if (!mappedUserGroups.includes(group)) {
                return {error: 'User not in group: ' + group, code: 400}
            }
            const getIntegratorsInGroup: QueryCommandInput = {
                TableName: table,
                KeyConditionExpression: 'PK = :pk and begins_with(SK, :sk)',
                ExpressionAttributeValues: {
                    ':pk': { S: group },
                    ':sk': { S: 'integrator#'}
                }
            }
            const getIntegratorsInGroupCommand = new QueryCommand(getIntegratorsInGroup)
            const integratorGroup = await dynamoDB.send(getIntegratorsInGroupCommand)
            integratorGroup.Items!.forEach(item => {
                integratorGroupsKeys.push(unmarshall(item) as IGetRelationResponse)
            })
        }

        const integratorKeys = integratorGroupsKeys.map(integrator => {
            return {
                PK: { S: integrator.SK.substring(11) },
                SK: { S: 'integrator' }
            }
        })

        const getIntegratorsParamas: BatchGetItemCommandInput = {
            RequestItems: {
                [table]: {
                    Keys: integratorKeys
                }
            }
        }

        const getintegratorsCommand = new BatchGetItemCommand(getIntegratorsParamas)

        const getIntegratorsResult = await dynamoDB.send(getintegratorsCommand)

        if(getIntegratorsResult.Responses && getIntegratorsResult.Responses[table] ){
            const integrators = getIntegratorsResult.Responses[table].map(item => unmarshall(item) as Integrator);

            const result: IGetIntegratorsFromGroupsResponse[] = []
            integratorGroupsKeys.map(group => {
                result.push({
                    [group.PK]: integrators.filter(integrator => integrator.PK === group.SK.substring(11))
                })
            })
            return result
        }
        return {error: `Could not get batchGetItemResult.Responses for ${userID}`, code: 500}

    }
    catch (e) {
        console.error('Error in getIntegratorsFromGroup function: ' + e)
        return { error: 'Error in getIntegratorsFromGroup function: ' + e, code: 500 }
    }
}

export const checkIfIntegratorIsInGroup = async (integratorGroupID: string, integratorID: string): Promise<IFunctionSuccess | IFunctionError | IGetRelationResponse> => {
    try {
        const table = process.env.DYNAMODB_TABLE_NAME || ''

        const getIntegratorInGroupCommandInput: GetItemCommandInput = {
            TableName: table,
            Key: {
                PK: { S: integratorGroupID },
                SK: { S: `integrator#${integratorID}`}
            }
        }
        const getIntegratorInGroupCommand = new GetItemCommand(getIntegratorInGroupCommandInput)

        const integratorInGroup = await dynamoDB.send(getIntegratorInGroupCommand)

        if(integratorInGroup?.Item){
            return unmarshall(integratorInGroup.Item) as IGetRelationResponse
        }
        return { success: `Integrator ${integratorID} not in group ${integratorGroupID}` }
    }
    catch (e) {
        console.error('Error in checkIfIntegratorIsInGroup function: ' + e)
        return { error: 'Error in checkIfIntegratorIsInGroup function: ' + e, code: 500 }
    }
}

// test function only used to create sample data
export const createEntries = async(creatorID: string, userID: string, integratorID: string, entries: IntegratorEntry[]): Promise<IFunctionSuccess | IFunctionError> => {
    try {
        const table = process.env.DYNAMODB_TABLE_NAME || ''

        const creator = await getUserByID(creatorID)

        if(!creator.role.isService) return { error: 'User is not a service user', code: 403 }

        const managerHasIntegrator = await getIntegrator(creatorID, userID, integratorID)

        if('error' in managerHasIntegrator) {
            console.error('Error in managerHasIntegrator: ' + managerHasIntegrator.error)
            return { error: 'Error in managerHasIntegrator: ' + managerHasIntegrator.error, code: managerHasIntegrator.code}
        }

        if(entries.filter(entry => entry.totalCrushed <= 0).length > 0) {
            return { error: 'totalCrushed must be greater than 0!', code: 400}
        }

        const integratorEntries: Record<any, any>[] = entries.map(entry => {
            return {
                PutRequest: {
                    Item: {
                        PK: {S: integratorID},
                        SK: {S: entry.SK},
                        totalCrushed: {N: `${entry.totalCrushed}`}
                    }
                }
            }
        })

        const integratorEntriesParams: BatchWriteItemCommandInput = {
            RequestItems: {
                [table]: integratorEntries
            }
        }

        const createEntriesCommand = new BatchWriteItemCommand(integratorEntriesParams)

        await dynamoDB.send(createEntriesCommand)

        return { success: 'Successfully added entries' }

    }
    catch (e) {
        return { error: 'Error in createEntry function: ' + e, code: 500 }
    }
}

export const createReportForDateRange = async (requesterID: string, userID: string, reportName: string, data: IReportData[]): Promise<object | IFunctionError> => {
    try {
        const table = process.env.DYNAMODB_TABLE_NAME || ''
        const bucket = process.env.BUCKET

        const requester = await getUserByID(requesterID)

        if(!requester.role.isService && !requester.role.isManager){
            return {error: 'User is neither a service user nor a manager', code: 403}
        }

        if(!requester.role.isService) userID = requesterID

        if(data.length === 0) return { error: 'Data must have length greater than 0!', code: 400 }

        const dataToGet: IEntriesToGet[] = []

        const resultJSON = new Map()

        const integratorGroups = new Map()

        const integrators = []

        for(const range of data) {
            if(range.isGroup) {
                const integratorsFromGroups = await getIntegratorsFromGroups(requesterID, userID, [range.PK])
                if('error' in integratorsFromGroups){
                    console.error('Error in integratorsFromGroups: ' + integratorsFromGroups.error)
                    return { error: 'Error in integratorsFromGroups: ' + integratorsFromGroups.error, code: integratorsFromGroups.code }
                }
                for(const group of integratorsFromGroups) {
                    integratorGroups.set(range.PK, [])
                    for(const groupKey in group) {
                        const integrators = group[groupKey]
                        integratorGroups.get(range.PK).push({
                            group: groupKey,
                            integrators: integrators,
                            RangeStart: range.RangeStart,
                            RangeEnd: range.RangeEnd
                        })
                        for(const integrator of integrators) {
                            dataToGet.push({
                                PK: integrator.PK!,
                                RangeStart: range.RangeStart,
                                RangeEnd: range.RangeEnd
                            })
                        }
                    }
                }
            }
            else {
                const managerHasIntegrator = await getIntegrator(requesterID, userID, range.PK)
                if('error' in managerHasIntegrator){
                    console.error('Error in managerHasIntegrator: ' + managerHasIntegrator.error)
                    return { error: managerHasIntegrator.error, code: managerHasIntegrator.code }
                }
                integrators.push({
                    PK: range.PK,
                    RangeStart: range.RangeStart,
                    RangeEnd: range.RangeEnd
                })
                dataToGet.push({
                    PK: range.PK,
                    RangeStart: range.RangeStart,
                    RangeEnd: range.RangeEnd
                })
            }
        }

        const queryParams: QueryCommandInput[] = dataToGet.map(data => {
            return {
                TableName: table,
                KeyConditionExpression: 'PK = :pk and SK between :startDate and :endDate',
                ExpressionAttributeValues: {
                    ':pk': { S: data.PK },
                    ':startDate': { S: data.RangeStart },
                    ':endDate': { S: data.RangeEnd }
                }
            }
        })

        const executeQuery = async (params: QueryCommandInput) => {
            const command = new QueryCommand(params)
            const response = await dynamoDB.send(command)
            const unmarshalledItems = []
            if(response.Items){
                for(const item of response.Items){
                    unmarshalledItems.push(unmarshall(item) as IntegratorEntry)
                }
                return unmarshalledItems
            }
            return { error: 'Could not execute query '}
        }

        const results = await Promise.all(queryParams.map(executeQuery))

        const errorResult = results.find(result => 'error' in result)
        if (errorResult && 'error' in errorResult) {
            console.error(errorResult.error)
            return { error: errorResult.error, code: 500 }
        }

        const resultsArray = results.flat() as IntegratorEntry[]

        for(const [groupPK, groupValue] of integratorGroups.entries()){
            const groupKey = `group#${groupValue[0].group}`
            for(const integrator of groupValue[0].integrators){
                const entryData = resultsArray.filter(result => {
                    if(result.PK === integrator.PK && result.SK >= groupValue[0].RangeStart && result.SK <= groupValue[0].RangeEnd){
                        return { SK: result.SK, totalCrushed: result.totalCrushed }
                    }
                    return
                })
                const entryDataWithoutDuplicates = [...new Set(entryData)]
                resultJSON.set(groupKey, entryDataWithoutDuplicates)
            }
        }
        for(const integrator of integrators){
            const entryData = resultsArray.filter(result => {
                if(result.PK === integrator.PK && result.SK >= integrator.RangeStart && result.SK <= integrator.RangeEnd){
                    return {SK: result.SK, totalCrushed: result.totalCrushed}
                }
                return
            })
            const entryDataWithoutDuplicates = [...new Set(entryData)]
            resultJSON.set(`integrator#${integrator.PK}`, entryDataWithoutDuplicates)
        }

        const saveDataToDynamoItem: Record<string, any> = {
            PK: { S: requesterID },
            SK: requester.role.isService ? { S: `report#${requesterID}/${userID}/${reportName}` } : { S: `report#${requesterID}/${reportName}` },
        }

        const saveDataToDynamoParams: PutItemCommandInput = {
            TableName: table,
            Item: saveDataToDynamoItem
        }

        const saveDataToDynamo = new PutItemCommand(saveDataToDynamoParams)
        await dynamoDB.send(saveDataToDynamo)

        const resultData = Array.from(resultJSON.entries())

        const saveReportToS3Command = new PutObjectCommand({
            Bucket: bucket,
            Key: requester.role.isService ? `${requesterID}/${userID}/${reportName}.json` : `${requesterID}/${reportName}.json`,
            Body: JSON.stringify(resultData)
        })

        await s3Client.send(saveReportToS3Command)

        return {reportName: reportName, data: resultData}
    }

    catch (e) {
        console.error('Error in createReportForDateRange function: ' + e)
        return { error: 'Error in createReportForDateRange function: ' + e, code: 500 }
    }
}

export const getReportsFromDynamo = async (requesterID: string): Promise<IGetRelationResponse[] | IFunctionError> => {
    try {
        const table = process.env.DYNAMODB_TABLE_NAME || ''

        const requester = await getUserByID(requesterID)

        if(!requester.role.isService && !requester.role.isManager){
            return { error: 'User is not a service user nor a manager', code: 403 }
        }

        const queryParams: QueryCommandInput = {
            TableName: table,
            KeyConditionExpression: 'PK = :pk and begins_with(SK, :sk)',
            ExpressionAttributeValues: {
                ':pk': { S: requesterID },
                ':sk': { S: 'report#'}
            }
        }
        const queryCommand = new QueryCommand(queryParams)
        const result = await dynamoDB.send(queryCommand)
        if(result.Items){
            return result.Items.map(item => unmarshall(item) as IGetRelationResponse)
        }
        console.error('No result.Items')
        return { error: 'No result.Items', code: 500 }
    }
    catch (e) {
        console.error('Error in getReportsFromDynamo: ' + e)
        return {error: 'Error in getReportsFromDynamo: ' + e, code: 500}
    }
}

export const getReportFromS3 = async (requesterID: string, path: string): Promise<object | IFunctionError> => {
    try {
        const bucket = process.env.BUCKET

        const requester = await getUserByID(requesterID)

        if(!requester.role.isService && !requester.role.isManager){
            return { error: 'User is not a service user nor a manager', code: 403 }
        }

        const command = new GetObjectCommand({
            Bucket: bucket,
            Key: `${path}.json`
        })
        const item = await s3Client.send(command)
        if(item.Body){
            const str = await item.Body.transformToString()
            return JSON.parse(str)
        }
        console.error('Could not get item from S3')
        return { error: 'Could not get item from S3', code: 500}
    }
    catch (e) {
        console.error('Error in getReportFromS3: ' + e)
        return {error: 'Error in getReportFromS3: ' + e, code: 500}
    }
}

export const editUser = async (requesterID: string, userID: string, editData: IEditUser)=> {
    try {
        const table = process.env.DYNAMODB_TABLE_NAME || ''
        const userPool = process.env.USER_POOL_ID || ''

        const requester = await getUserByID(requesterID)

        if(!requester.role.isService && !requester.role.isManager) userID = requesterID
        else if(requester.role.isManager && userID !== requesterID){
            const worker = await getWorker(requesterID, requesterID, userID)
            if('error' in worker){
                console.error('Error in worker: ' + worker.error)
                return {error: 'Error in worker: ' + worker.error, code: worker.code}
            }
        }

        if('isDeleted' in editData && (requester.role.isService || requester.role.isManager) ){
            const editItemInput: UpdateItemCommandInput = {
                TableName: table,
                ExpressionAttributeValues: {
                    ':val': { BOOL: editData.isDeleted! }
                },
                Key: {
                    'PK': { S: userID },
                    'SK': { S: 'user' }
                },
                ReturnValues: "ALL_NEW",
                UpdateExpression: "SET isDeleted = :val"
            }
            const updateCommand = new UpdateItemCommand(editItemInput)
            const query = await dynamoDB.send(updateCommand)
            if(query.Attributes){
                if(editData.isDeleted){
                    const disableUserCommandInput: AdminDisableUserCommandInput = {
                        UserPoolId: userPool,
                        Username: userID
                    }
                    await cognitoIdentityProvider.adminDisableUser(disableUserCommandInput)
                }
                else {
                    const enableUserCommandInput: AdminEnableUserCommandInput = {
                        UserPoolId: userPool,
                        Username: userID
                    }
                    await cognitoIdentityProvider.adminEnableUser(enableUserCommandInput)
                }
                return unmarshall(query.Attributes)
            }
            console.error('Could not update the item')
            return {error: 'Could not update the item', code: 500}
        }
        else if('isDeleted' in editData && (!requester.role.isService && !requester.role.isManager)){
            console.error('Worker cannot delete his account')
            return {error: 'Worker cannot delete his account', code: 403}
        }
        else {
            const user = await getUserByID(userID)
            user.cognitoAttributes = [...user.cognitoAttributes, ...editData.cognitoAttributes!]
            const editItemInput: UpdateItemCommandInput = {
                TableName: table,
                ExpressionAttributeValues: {
                    ":updatedAttributes": { L: user.cognitoAttributes.map(attr => ({ M: { Name: { S: attr.Name }, Value: { S: attr.Value } } })) }
                },
                Key: {
                    'PK': { S: userID },
                    'SK': { S: 'user' }
                },
                ReturnValues: "ALL_NEW",
                UpdateExpression: "SET cognitoAttributes = :updatedAttributes"
            }
            const updateCommand = new UpdateItemCommand(editItemInput)
            const query = await dynamoDB.send(updateCommand)
            if(query.Attributes){
                return unmarshall(query.Attributes)
            }
            console.error('Could not update the item')
            return {error: 'Could not update the item', code: 500}
        }
    }
    catch (e) {
        console.error('Error in editUser: ' + e)
        return { error: 'Error in editUser: ' + e, code: 500 }
    }
}

export const editIntegrator = async (requesterID: string, userID: string, editData: IEditIntegrator): Promise<Integrator | IFunctionError>=> {
    try {
        const table = process.env.DYNAMODB_TABLE_NAME || ''

        const requester = await getUserByID(requesterID)

        let integrator: Integrator

        if(!requester.role.isService) userID = requesterID
        if(requester.role.isManager || requester.role.isService){
            const integrators = await getIntegrators(requesterID, userID)
            if('error' in integrators){
                console.error('Error in integrator: ' + integrators.error)
                return {error: 'Error in integrator: ' + integrators.error, code: integrators.code}
            }
            console.log('editData: ' + JSON.stringify(editData, null, 2))
            console.log('Integratory: ' + JSON.stringify(integrators, null, 2))
            const foundIntegrator = integrators.find(item => item.PK === editData.PK!)
            if(foundIntegrator){
                integrator = foundIntegrator
            } else {
                console.error('Manager does not have this integrator')
                return {error: 'Manager does not have this integrator', code: 400}
            }
        }
        else {
            const groups = await getIntegratorGroups(userID, requesterID)
            if('error' in groups){
                console.error('Error in integrator: ' + groups.error)
                return {error: 'Error in integrator: ' + groups.error, code: groups.code}
            }
            const integrators = await getIntegratorsFromGroups(requesterID, userID, groups.map(group => group.PK!))
            if('error' in integrators){
                console.error('Error in integrator: ' + integrators.error)
                return {error: 'Error in integrator: ' + integrators.error, code: integrators.code}
            }
            let integratorsArray: any[] = []
            for(const group in integrators){
                if(Object.prototype.hasOwnProperty.call(integrators, group)){
                    integratorsArray = integratorsArray.concat(integrators[group])
                }
            }

            integrator = integratorsArray.find(item => item.PK === editData.PK!)

            if (!integrator) {
                console.error('User does not have access to this integrator')
                return { error: 'User does not have access to this integrator', code: 403 }
            }
        }
        if('isDeleted' in editData && (requester.role.isService || requester.role.isManager) ){
            const editItemInput: UpdateItemCommandInput = {
                TableName: table,
                ExpressionAttributeValues: {
                    ':val': { BOOL: editData.isDeleted! }
                },
                Key: {
                    'PK': { S: editData.PK! },
                    'SK': { S: 'integrator' }
                },
                ReturnValues: "ALL_NEW",
                UpdateExpression: "SET isDeleted = :val"
            }
            const updateCommand = new UpdateItemCommand(editItemInput)
            const query = await dynamoDB.send(updateCommand)
            if(query.Attributes){
                return unmarshall(query.Attributes)
            }
            console.error('Could not update the item')
            return {error: 'Could not update the item', code: 500}
        }
        else if('isDeleted' in editData && (!requester.role.isService && !requester.role.isManager)){
            console.error('Worker cannot delete an integrator')
            return {error: 'Worker cannot delete an integrator', code: 403}
        }
        else {
            if(!requester.role.isManager && !requester.role.isService){
                integrator.status = editData.status
            }
            else {
                integrator = {...integrator, ...editData}
            }
            const editItemInput: UpdateItemCommandInput = {
                TableName: table,
                ExpressionAttributeValues: {
                    ':location': {S: integrator.location! },
                    ':serialNumber': {S: integrator.serialNumber! },
                    ':status': {N: integrator.status!.toString() }
                },
                ExpressionAttributeNames: {
                    '#l': 'location',
                    '#s': 'status'
                },
                Key: {
                    'PK': { S: editData.PK! },
                    'SK': { S: 'integrator' }
                },
                ReturnValues: "ALL_NEW",
                UpdateExpression: "SET #l = :location, serialNumber = :serialNumber, #s = :status"
            }
            const updateCommand = new UpdateItemCommand(editItemInput)
            const query = await dynamoDB.send(updateCommand)
            if(query.Attributes){
                return unmarshall(query.Attributes)
            }
            console.error('Could not update the item')
            return {error: 'Could not update the item', code: 500}
        }
    }
    catch (e) {
        console.error('Error in editIntegrator: ' + e)
        return { error: 'Error in editIntegrator: ' + e, code: 500 }
    }
}

export const editIntegratorGroup = async (requesterID: string, userID: string, editData: IEditGroup): Promise<IntegratorGroup | IFunctionError> => {
    try {
        const table = process.env.DYNAMODB_TABLE_NAME || ''

        const requester = await getUserByID(requesterID)

        if(!requester.role.isService && !requester.role.isManager){
            return {error: 'User is neither a service user nor a manager', code: 403}
        }

        const groups = await getIntegratorGroups(userID, requesterID)
        if('error' in groups){
            console.error('Error in groups: ' + groups.error)
            return {error: 'Error in groups: ' + groups.error, code: groups.code}
        }

        const group = groups.find(grp => grp.PK === editData.PK)

        if(!group){
            console.error('Manager does not have this group')
            return {error: 'Manager does not have this group', code: 400}
        }
        if('isDeleted' in editData){
            const editItemInput: UpdateItemCommandInput = {
                TableName: table,
                ExpressionAttributeValues: {
                    ':val': { BOOL: editData.isDeleted! }
                },
                Key: {
                    'PK': { S: editData.PK! },
                    'SK': { S: 'group' }
                },
                ReturnValues: "ALL_NEW",
                UpdateExpression: "SET isDeleted = :val"
            }
            const updateCommand = new UpdateItemCommand(editItemInput)
            const query = await dynamoDB.send(updateCommand)
            if(query.Attributes){
                return unmarshall(query.Attributes)
            }
            console.error('Could not update the item')
            return {error: 'Could not update the item', code: 500}
        }

        else {
            const editedGroup = {...group, ...editData as IntegratorGroup}

            const editItemInput: UpdateItemCommandInput = {
                TableName: table,
                ExpressionAttributeValues: {
                    ':integratorGroupName': {S: editedGroup.integratorGroupName! }
                },
                Key: {
                    'PK': { S: editedGroup.PK! },
                    'SK': { S: 'group' }
                },
                ReturnValues: "ALL_NEW",
                UpdateExpression: "SET integratorGroupName = :integratorGroupName"
            }
            const updateCommand = new UpdateItemCommand(editItemInput)
            const query = await dynamoDB.send(updateCommand)
            if(query.Attributes){
                return unmarshall(query.Attributes)
            }
            console.error('Could not update the item')
            return {error: 'Could not update the item', code: 500}
        }
    }
    catch (e) {
        console.error('Error in editIntegratorGroup: ' + e)
        return { error: 'Error in editIntegratorGroup: ' + e, code: 500 }
    }
}

export const removeUserFromGroup = async (requesterID: string, managerID: string, userID: string, groupID: string): Promise<IGetRelationResponse | IFunctionError> => {
    try {
        const table = process.env.DYNAMODB_TABLE_NAME || ''

        const requester = await getUserByID(requesterID)

        if(!requester.role.isService && !requester.role.isManager){
            return {error: 'User is neither a service user nor a manager', code: 403}
        }

        if(requester.role.isService && requesterID !== managerID){
            const manager = await getUserByID(managerID)
            if(!manager.role.isManager) {
                return {error: `There is no manager with PK ${managerID}`, code: 400}
            }
        }
        else if(requester.role.isManager) managerID = requesterID

        if(managerID === userID){
            return { error: 'A manager cannot be removed from a group!', code: 400 }
        }

        const worker = await getWorker(requesterID, managerID, userID)
        if('error' in worker){
            console.error('Error in worker: ' + worker.error)
            return {error: 'Error in worker: ' + worker.error, code: worker.code}
        }

        const groups = await getIntegratorGroups(managerID, requesterID)
        if('error' in groups){
            console.error('Error in groups: ' + groups.error)
            return {error: 'Error in groups: ' + groups.error, code: groups.code}
        }

        const group = groups.find(grp => grp.PK === groupID)

        if(!group){
            console.error('Manager does not have this group')
            return {error: 'Manager does not have this group', code: 400}
        }

        const userIsInGroup = await checkIfUserIsInGroup(groupID, userID)

        if('error' in userIsInGroup){
            console.error('Error in userIsInGroup: ' + userIsInGroup.error)
            return { error: 'Error in userIsInGroup: ' + userIsInGroup.error, code: userIsInGroup.code }
        }
        else if('success' in userIsInGroup){
            return { error: 'User not in group', code: 400 }
        }

        const groupRelationParams: GetItemCommandInput = {
            TableName: table,
            Key: {
                PK: { S: userID },
                SK: { S: `group#${groupID}`}
            }
        }
        const getGroupRelationCommand = new GetItemCommand(groupRelationParams)

        const groupRelation = await dynamoDB.send(getGroupRelationCommand)

        if(!groupRelation?.Item){
            return { error: `User ${userID} not in group ${groupID}`, code: 400 }
        }

        const updateGroupRelationParams: UpdateItemCommandInput = {
            TableName: table,
            ExpressionAttributeValues: {
                ':isDeleted': { BOOL: true }
            },
            Key: {
                'PK': { S: userID },
                'SK': { S: `group#${groupID}` }
            },
            ReturnValues: "ALL_NEW",
            UpdateExpression: "SET isDeleted = :isDeleted"
        }
        const updateCommand = new UpdateItemCommand(updateGroupRelationParams)
        const query = await dynamoDB.send(updateCommand)
        if(query.Attributes){
            return unmarshall(query.Attributes) as IGetRelationResponse
        }
        console.error('Could not update the item')
        return {error: 'Could not update the item', code: 500}
    }
    catch (e) {
        console.error('Error in removeUserFromGroup: ' + e)
        return { error: 'Error in removeUserFromGroup: ' + e, code: 500 }
    }
}

export const removeIntegratorFromGroup = async (requesterID: string, managerID: string, integratorID: string, groupID: string) => {
    try {
        const table = process.env.DYNAMODB_TABLE_NAME || ''

        const requester = await getUserByID(requesterID)

        if(!requester.role.isService && !requester.role.isManager){
            return {error: 'User is neither a service user nor a manager', code: 403}
        }

        if(requester.role.isService && requesterID !== managerID){
            const manager = await getUserByID(managerID)
            if(!manager.role.isManager) {
                return {error: `There is no manager with PK ${managerID}`, code: 400}
            }
        }
        else if(requester.role.isManager) managerID = requesterID

        const integrator = await getIntegrator(requesterID, managerID, integratorID)
        if('error' in integrator){
            console.error('Error in worker: ' + integrator.error)
            return {error: 'Error in worker: ' + integrator.error, code: integrator.code}
        }

        const groups = await getIntegratorGroups(managerID, requesterID)
        if('error' in groups){
            console.error('Error in groups: ' + groups.error)
            return {error: 'Error in groups: ' + groups.error, code: groups.code}
        }

        const group = groups.find(grp => grp.PK === groupID)

        if(!group){
            console.error('Manager does not have this group')
            return {error: 'Manager does not have this group', code: 400}
        }

        const integratorIsInGroup = await checkIfIntegratorIsInGroup(groupID, integratorID)

        if('error' in integratorIsInGroup){
            console.error('Error in integratorIsInGroup: ' + integratorIsInGroup.error)
            return { error: 'Error in integratorIsInGroup: ' + integratorIsInGroup.error, code: integratorIsInGroup.code }
        }
        else if('success' in integratorIsInGroup){
            return { error: 'Integrator not in group', code: 400 }
        }

        const groupRelationParams: GetItemCommandInput = {
            TableName: table,
            Key: {
                PK: { S: groupID },
                SK: { S: `integrator#${integratorID}`}
            }
        }

        const getGroupRelationCommand = new GetItemCommand(groupRelationParams)

        const groupRelation = await dynamoDB.send(getGroupRelationCommand)

        if(!groupRelation?.Item){
            return { error: `Integrator ${integratorID} not in group ${groupID}`, code: 400 }
        }

        const updateGroupRelationParams: UpdateItemCommandInput = {
            TableName: table,
            ExpressionAttributeValues: {
                ':isDeleted': { BOOL: true }
            },
            Key: {
                'PK': { S: groupID },
                'SK': { S: `integrator#${integratorID}` }
            },
            ReturnValues: "ALL_NEW",
            UpdateExpression: "SET isDeleted = :isDeleted"
        }
        const updateCommand = new UpdateItemCommand(updateGroupRelationParams)
        const query = await dynamoDB.send(updateCommand)
        if(query.Attributes){
            return unmarshall(query.Attributes) as IGetRelationResponse
        }
        console.error('Could not update the item')
        return {error: 'Could not update the item', code: 500}
    }
catch (e) {
    console.error('Error in removeIntegratorFromGroup: ' + e)
    return { error: 'Error in removeIntegratorFromGroup: ' + e, code: 500 }
    }
}