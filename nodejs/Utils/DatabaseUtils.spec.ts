import {DynamoDBClient, GetItemCommand} from "@aws-sdk/client-dynamodb";
import {managerMock, serviceUserMock, workerMock} from "../Mocks/getUserMocks";
import * as DatabaseUtils from "./DatabaseUtils"
import {
    AdminCreateUserCommandOutput,
    CognitoIdentityProvider
} from "@aws-sdk/client-cognito-identity-provider";
import {
    createManagerWithManagerMock,
    createServiceUserMock,
    createUserMock,
    createUserSuccessCognitoMock,
    createUserSuccessMock, createUserSuccessReturnMock,
    createUserWithEmailNotMatchingUsernameMock,
    createUserWithNoAttributesFoundInCognitoMock,
    createUserWithNoManagerMock,
    createUserWithNoUserAttributesMock,
    createUserWithNoUsernameMock,
} from "../Mocks/createUserMocks";
import {initiateAuthNewPwdMock, initiateAuthNoTokensMock, initiateAuthSuccessMock} from "../Mocks/userLoginMocks";
import {subMock} from "../Mocks/getUserAttributesFromCognitoMocks";
import {
    noAccessTokenMock,
    noSubMock,
    successAuthResultMock,
    successReturnMock
} from "../Mocks/respondToNewPwdCognitoChallengeMocks";
import {managerByIDMock, serviceByIDMock, workerByIDMock} from "../Mocks/getUserByIDMocks";
import {noAttributesMock, userInfoSuccessMock} from "../Mocks/getUserInfoMocks";
import {emptyResponsesMock, filledResponsesMock, successResponseMock} from "../Mocks/getWorkersMocks";
import {createIntegratorSuccess} from "../Mocks/createIntegratorMocks";
import {batchGetItemsMock, resultItemsGetIntegratorsMock, successObjectMock} from "../Mocks/getIntegratorsMocks";
import {
    getIntegratorGroupMock,
    getWorkerMock,
    successMock,
    checkIfUserIsInGroupMock
} from "../Mocks/addUserToIntegratorGroupMocks";
import {getIntegratorMock, checkIfIntegratorIsInGroupMock, addIntegratorToGroupsuccessMock} from "../Mocks/addIntegratorToGroupMocks";
import {
    batchGetItemsGetIntegratorGroupsMock, getIntegratorGroupsSuccessMock,
    resultItemsGetIntegratorGroupsMock
} from "../Mocks/getIntegratorGroupsMocks";
import {
    GetIntegratorsFromGroupsSuccessObjectMock,
    getIntegratorsInGroupMock,
    resultItemsGetIntegratorsFromGroupsEmptyResponsesMock,
    resultItemsGetIntegratorsFromGroupsMock,
    resultItemsGetIntegratorsFromGroupsSuccessMock
} from "../Mocks/getIntegratorsFromGroupsMocks";
import {createIntegratorGroupSuccessMock} from "../Mocks/createIntegratorGroupMocks";

jest.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: jest.fn(),
    GetItemCommand: jest.fn(),
    BatchWriteItemCommand: jest.fn(),
    QueryCommand: jest.fn(),
    BatchGetItemCommand: jest.fn(),
    PutItemCommand: jest.fn()
}))

jest.mock('@aws-sdk/client-cognito-identity-provider', () => ({
    CognitoIdentityProvider: jest.fn(),
    GetUserCommand: jest.fn(),
    ListUsersCommand: jest.fn()
}))

describe('getUserByID tests', () => {

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('should return user data when user is found', async () => {
        DynamoDBClient.prototype.send = jest.fn().mockResolvedValueOnce(workerMock)

        const userID = 'userID123'
        const user = await DatabaseUtils.getUserByID(userID)

        expect(user).toEqual({
            PK: "userID123",
            SK: "user",
            email: "user@user.com",
            role: {
                isService: false,
                isManager: false
            }
        });
        expect(GetItemCommand).toHaveBeenCalledTimes(1)
        expect(GetItemCommand).toHaveBeenCalledWith({
            TableName: '',
            Key: {
                PK: { S: userID },
                SK: { S: 'user' },
            },
        })
    })
    it('should throw an error when user is not found', async () => {
        DynamoDBClient.prototype.send = jest.fn().mockResolvedValueOnce({})

        const userID = 'nonExistentUserID'

        await expect(DatabaseUtils.getUserByID(userID)).rejects.toThrow('Error getting user')

        expect(GetItemCommand).toHaveBeenCalledTimes(1)
        expect(GetItemCommand).toHaveBeenCalledWith({
            TableName: '',
            Key: {
                PK: { S: userID },
                SK: { S: 'user' },
            },
        })
    })
})
describe('createUser tests', () => {

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('should return an error when creator is not authorized to create a user', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(workerByIDMock)
        CognitoIdentityProvider.prototype.adminCreateUser = jest.fn().mockResolvedValueOnce({
            // @ts-ignore
            User: {Attributes: [{Name: 'sub', Value: 'mockUserID'}]} as AdminCreateUserCommandOutput
        })
        // @ts-ignore
        const result = await DatabaseUtils.createUser(createUserMock, 'managerID');
        if ('error' in result)
            expect(result.error).toMatch('Worker cannot create users');

    });

    it('should return an error when manager tries to create service user', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(managerByIDMock)
        // @ts-ignore
        const result = await DatabaseUtils.createUser(createServiceUserMock, 'mockUserID')
        if ('error' in result)
            expect(result.error).toMatch('Manager cannot create a manager or service user')
    })

    it('should return an error when username is missing', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(managerByIDMock)
        // @ts-ignore
        const result = await DatabaseUtils.createUser(createUserWithNoUsernameMock, 'mockUserID')
        if ('error' in result)
            expect(result.error).toMatch('Missing username')
    })

    it('should return an error when a service user is trying to create a worker with no manager', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(serviceByIDMock)
        // @ts-ignore
        const result = await DatabaseUtils.createUser(createUserWithNoManagerMock, 'mockUserID')
        if ('error' in result)
            expect(result.error).toMatch('The worker must have a manager')
    })

    it('should return an error when a service user is trying to create a manager with a manager', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(serviceByIDMock)
        // @ts-ignore
        const result = await DatabaseUtils.createUser(createManagerWithManagerMock, 'mockUserID')
        if ('error' in result)
            expect(result.error).toMatch('The manager cannot have a manager')
    })

    it('should return an error when manager tries to create user for another manager', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(managerByIDMock)
        // @ts-ignore
        const result = await DatabaseUtils.createUser(createUserMock, 'mockUserID')
        if ('error' in result)
            expect(result.error).toMatch('The manager cannot create users for other managers')
    })

    it('should return an error when userAttributes is empty', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(managerByIDMock)
        // @ts-ignore
        const result = await DatabaseUtils.createUser(createUserWithNoUserAttributesMock, 'userID123')
        if ('error' in result)
            expect(result.error).toMatch('userAttributes cannot be empty')
    })

    it('should return an error when email is not matching username', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(managerByIDMock)
        // @ts-ignore
        const result = await DatabaseUtils.createUser(createUserWithEmailNotMatchingUsernameMock, 'userID123')
        if ('error' in result)
            expect(result.error).toMatch('username and email do not match')
    })
    it('should return an error when no user attributes are found in the response', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(managerByIDMock)
        CognitoIdentityProvider.prototype.adminCreateUser = jest.fn().mockResolvedValueOnce({})
        // @ts-ignore
        const result = await DatabaseUtils.createUser(createUserWithNoAttributesFoundInCognitoMock, 'userID123')
        if ('error' in result)
            expect(result.error).toMatch('No user attributes found in the response')
    })
    it('should return a user function is successful', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(managerByIDMock)
        DynamoDBClient.prototype.send = jest.fn().mockResolvedValueOnce(createUserSuccessMock)
        CognitoIdentityProvider.prototype.adminCreateUser = jest.fn().mockResolvedValueOnce(createUserSuccessCognitoMock)
        // @ts-ignore
        const result = await DatabaseUtils.createUser(createUserSuccessMock, 'userID123')

        expect(result).toEqual(createUserSuccessReturnMock)
    })

})
describe('userLogin tests', () => {

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('should return an error when there is no auth result', async () => {
        CognitoIdentityProvider.prototype.initiateAuth = jest.fn().mockResolvedValueOnce(undefined)
        const result = await DatabaseUtils.userLogin({username: 'testuser', password: 'testpassword'})
        if('error' in result)
        expect(result.error).toMatch('could not get auth result')
    })

    it('should return challenge response when challenge exists', async () => {
        CognitoIdentityProvider.prototype.initiateAuth = jest.fn().mockResolvedValueOnce(initiateAuthNewPwdMock)
        const result = await DatabaseUtils.userLogin({username: 'testuser', password: 'testpassword'})
        expect(result).toEqual({
            challengeName: 'NEW_PASSWORD_REQUIRED',
            challengeParameters: {'userAttributes': 'attributes'},
            session: 'session'
        })
    })

    it('should return an error when AccessToken and IdToken are not present', async () => {
        CognitoIdentityProvider.prototype.initiateAuth = jest.fn().mockResolvedValueOnce(initiateAuthNoTokensMock)
        const result = await DatabaseUtils.userLogin({username: 'testuser', password: 'testpassword'})
        if('error' in result) {
            expect(result.error).toMatch('Could not get AccessToken or IdToken')
        }
    })

    it('should return tokens when authentication is successful', async () => {
        CognitoIdentityProvider.prototype.initiateAuth = jest.fn().mockResolvedValueOnce(initiateAuthSuccessMock)
        CognitoIdentityProvider.prototype.send = jest.fn().mockResolvedValueOnce(subMock)
        const result = await DatabaseUtils.userLogin({ username: 'testuser', password: 'testpassword' })
        expect(result).toEqual({
            sub: 'mockSub',
            id_token: 'idToken',
            access_token: 'accessToken'
        })
    })
    it('should return an error when sub is not present', async () => {
        CognitoIdentityProvider.prototype.initiateAuth = jest.fn().mockResolvedValueOnce(initiateAuthSuccessMock)
        const result = await DatabaseUtils.userLogin({ username: 'testuser', password: 'testpassword' })
        if('error' in result){
            expect(result.error).toMatch('Could not get sub')
        }
    })
    it('should return an error when there is no response from cognito', async () => {
        CognitoIdentityProvider.prototype.initiateAuth = jest.fn().mockResolvedValueOnce({})
        const result = await DatabaseUtils.userLogin({ username: 'testuser', password: 'testpassword' })
        if('error' in result){
            expect(result.error).toMatch('Could not get response from cognito: ')
        }
    })
})
describe('respondToNewPwdCognitoChallenge tests', () => {

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('should return an error when there is no response from cognito', async () => {
        CognitoIdentityProvider.prototype.respondToAuthChallenge = jest.fn().mockResolvedValueOnce({})
        const result = await DatabaseUtils.respondToNewPwdCognitoChallenge('test', 'test', 'test')
        if('error' in result){
            expect(result.error).toMatch('Could not get response from cognito: ')
        }
    })

    it('should return an error when there is no AccessToken or IdToken', async () => {
        CognitoIdentityProvider.prototype.respondToAuthChallenge = jest.fn().mockResolvedValueOnce(noAccessTokenMock)
        const result = await DatabaseUtils.respondToNewPwdCognitoChallenge('test', 'test', 'test')
        if('error' in result){
            expect(result.error).toMatch('Could not get AccessToken or IdToken')
        }
    })

    it('should return an error when there is no sub', async () => {
        CognitoIdentityProvider.prototype.respondToAuthChallenge = jest.fn().mockResolvedValueOnce(noSubMock)
        const result = await DatabaseUtils.respondToNewPwdCognitoChallenge('test', 'test', 'test')
        if('error' in result){
            expect(result.error).toMatch('Could not get sub')
        }
    })

    it('should return the object when function is successful', async () => {
        CognitoIdentityProvider.prototype.respondToAuthChallenge = jest.fn().mockResolvedValueOnce(successAuthResultMock)
        CognitoIdentityProvider.prototype.send = jest.fn().mockResolvedValueOnce(subMock)
        const result = await DatabaseUtils.respondToNewPwdCognitoChallenge('test', 'test', 'test')
        expect(result).toEqual(successReturnMock)
    })

})
describe('getUserInfo tests', () => {

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('should return an error when user is a worker', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(workerByIDMock)
        const result = await DatabaseUtils.getUserInfo('test', 'test2')
        if('error' in result){
            expect(result.error).toMatch('Requester is neither a service user nor a manager')
        }
    })

    it('should return an error when manager does not have a worker with this id', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(managerByIDMock)
        jest.spyOn(DatabaseUtils, 'getWorker').mockResolvedValueOnce({error: '', code: 500})
        const result = await DatabaseUtils.getUserInfo('test', 'test2')
        if('error' in result){
            expect(result.error).toMatch('Error in worker: ')
        }
    })

    it('should return an object when function is successful', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(managerByIDMock).mockResolvedValueOnce(workerByIDMock)
        jest.spyOn(DatabaseUtils, 'getWorker').mockResolvedValueOnce({PK: '', SK: ''})
        const result = await DatabaseUtils.getUserInfo('test', 'test2')
        expect(result).toEqual(workerByIDMock)
    })

})
describe('getWorkers tests', () => {

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('should return an error when user is not a service user or a manager', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(workerByIDMock)
        const result = await DatabaseUtils.getWorkers('test')
        if('error' in result){
            expect(result.error).toMatch('User is neither a service user nor a manager')
        }
    })

    it('should return an error when cognito does not list users', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(serviceByIDMock)
        CognitoIdentityProvider.prototype.send = jest.fn().mockResolvedValueOnce({})
        const result = await DatabaseUtils.getWorkers('test')
        if('error' in result){
            expect(result.error).toMatch('could not get users')
        }
    })

    it('should return an error when dynamo does not list users for service user', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(serviceByIDMock)
        DynamoDBClient.prototype.send = jest.fn().mockResolvedValueOnce(emptyResponsesMock)
        CognitoIdentityProvider.prototype.send = jest.fn().mockResolvedValueOnce({Users: ['test']})
        const result = await DatabaseUtils.getWorkers('test')
        if('error' in result){
            expect(result.error).toMatch('could not get Responses')
        }
    })

    it('should return an error when dynamo does not return items for manager', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(managerByIDMock)
        DynamoDBClient.prototype.send = jest.fn()
            .mockResolvedValueOnce({Items: [{ PK: { S: 'test' }, SK: { S: 'user#test' } }]})
            .mockResolvedValueOnce(emptyResponsesMock)
        const result = await DatabaseUtils.getWorkers('test')
        if('error' in result){
            expect(result.error).toMatch('Could not get batchGetItemResult.Responses for test')
        }
    })

    it('should return an error when dynamo does not return items for manager', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(managerByIDMock)
        DynamoDBClient.prototype.send = jest.fn().mockResolvedValueOnce({})
        const result = await DatabaseUtils.getWorkers('test')
        if('error' in result){
            expect(result.error).toMatch('Could not get result.Items for manager')
        }
    })
    it('should return user for a service user', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(serviceByIDMock)
        DynamoDBClient.prototype.send = jest.fn().mockResolvedValueOnce(filledResponsesMock)
        CognitoIdentityProvider.prototype.send = jest.fn().mockResolvedValueOnce({Users: ['test']})
        const result = await DatabaseUtils.getWorkers('test')
        expect(result).toEqual(successResponseMock)
    })
    it('should return user for manager', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(managerByIDMock)
        DynamoDBClient.prototype.send = jest.fn()
            .mockResolvedValueOnce({Items: [{ PK: { S: 'userID123' }, SK: { S: 'user#userID123' } }]})
            .mockResolvedValueOnce(filledResponsesMock)
        const result = await DatabaseUtils.getWorkers('test')
        expect(result).toEqual(successResponseMock)
    })
})
describe('getWorker tests', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('should return an error when user is not a service user or a manager', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(workerByIDMock)
        const result = await DatabaseUtils.getWorker('test', 'test', 'test')
        if('error' in result){
            expect(result.error).toMatch('User is neither a service user nor a manager')
        }
    })

    it('should return an error when manager does not have a worker with this id', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(managerByIDMock)
        DynamoDBClient.prototype.send = jest.fn().mockResolvedValueOnce({})
        const result = await DatabaseUtils.getWorker('test', 'test', 'test')
        if('error' in result){
            expect(result.error).toMatch('Manager does not have a worker with this id: test')
        }
    })

    it('should return success', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(managerByIDMock)
        DynamoDBClient.prototype.send = jest.fn().mockResolvedValueOnce({ Item: { PK: { S: 'test' }, SK: { S: 'user#test' } } })
        const result = await DatabaseUtils.getWorker('test', 'test', 'test')
        expect(result).toEqual({ PK: 'test', SK: 'user#test' })
    })
})
describe('createIntegrator tests', () => {

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('should return an error when user is not a service user or a manager', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(workerByIDMock).mockResolvedValueOnce(workerByIDMock)
        const result = await DatabaseUtils.createIntegrator({
            location: 'test',
            serialNumber: 'test',
            userID: 'test',
            creatorID: 'test'
            })
        if('error' in result){
            expect(result.error).toMatch('User is neither a service user nor a manager')
        }
    })

    it('should return an error when there are missing params', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(serviceByIDMock).mockResolvedValueOnce(managerByIDMock)
        DynamoDBClient.prototype.send = jest.fn().mockResolvedValueOnce({})
        // @ts-ignore
        const result = await DatabaseUtils.createIntegrator({
            location: 'test',
            serialNumber: 'test',
        })
        if('error' in result){
            expect(result.error).toMatch('Missing params')
        }
    })

    it('should return success', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(serviceByIDMock).mockResolvedValueOnce(managerByIDMock)
        jest.spyOn(DatabaseUtils, 'generateId').mockReturnValueOnce('test')
        DynamoDBClient.prototype.send = jest.fn().mockResolvedValueOnce({})
        const result = await DatabaseUtils.createIntegrator({
            location: 'test',
            serialNumber: 'test',
            userID: 'test',
            creatorID: 'test'
        })
        expect(result).toEqual(createIntegratorSuccess)
    })
})
describe('getIntegrators tests', () => {

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('should return an error when no userID is provided', async () => {
        const result = await DatabaseUtils.getIntegrators('', 'test')
        if('error' in result){
            expect(result.error).toMatch('No userID')
        }
    })

    it('should return an error when there are no result.Items', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(managerByIDMock)
        DynamoDBClient.prototype.send = jest.fn().mockResolvedValueOnce({})
        const result = await DatabaseUtils.getIntegrators('test', 'test')
        if('error' in result){
            expect(result.error).toMatch('No result.Items')
        }
    })

    it('should return an error when there are no batchGetItemResult.Responses', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(managerByIDMock)
        DynamoDBClient.prototype.send = jest.fn().mockResolvedValueOnce(resultItemsGetIntegratorsMock).mockResolvedValueOnce({})
        const result = await DatabaseUtils.getIntegrators('test', 'test')
        if('error' in result){
            expect(result.error).toMatch('Could not get batchGetItemResult.Responses for test')
        }
    })

    it('should return success', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(managerByIDMock)
        DynamoDBClient.prototype.send = jest.fn().mockResolvedValueOnce(resultItemsGetIntegratorsMock).mockResolvedValueOnce(batchGetItemsMock)
        const result = await DatabaseUtils.getIntegrators('test', 'test')
        expect(result).toEqual(successObjectMock)
    })
})
describe('getIntegrator tests', () => {

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('should return an error when user is not a service user or a manager', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(workerByIDMock)
        const result = await DatabaseUtils.getIntegrator('test', 'test', 'test')
        if('error' in result){
            expect(result.error).toMatch('User is neither a service user nor a manager')
        }
    })

    it('should return an error when manager does not have a worker with this id', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(managerByIDMock)
        DynamoDBClient.prototype.send = jest.fn().mockResolvedValueOnce({})
        const result = await DatabaseUtils.getIntegrator('test', 'test', 'test')
        if('error' in result){
            expect(result.error).toMatch('Manager does not have an integrator with this id: test')
        }
    })

    it('should return success', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(managerByIDMock)
        DynamoDBClient.prototype.send = jest.fn().mockResolvedValueOnce({ Item: { PK: { S: 'test' }, SK: { S: 'integrator#test' } } })
        const result = await DatabaseUtils.getIntegrator('test', 'test', 'test')
        expect(result).toEqual({ PK: 'test', SK: 'integrator#test' })
    })
})
describe('addUserToIntegratorGroup tests', () => {

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('should return an error when getWorker errors', async () => {
        jest.spyOn(DatabaseUtils, 'getWorker').mockResolvedValueOnce({error: '', code: 500})
        const result = await DatabaseUtils.addUserToIntegratorGroup('test', 'test', 'test', 'test')
        if('error' in result){
            expect(result.error).toMatch('Error in managerHasWorkerWithID: ')
        }
    })

    it('should return an error when getIntegratorGroup errors', async () => {
        jest.spyOn(DatabaseUtils, 'getWorker').mockResolvedValueOnce(getWorkerMock)
        jest.spyOn(DatabaseUtils, 'getIntegratorGroup').mockResolvedValueOnce({error: '', code: 500})
        const result = await DatabaseUtils.addUserToIntegratorGroup('test', 'test', 'test', 'test')
        if('error' in result){
            expect(result.error).toMatch('Error in managerHasGroupWithID: ')
        }
    })

    it('should return an error when checkIfUserIsInGroup errors', async () => {
        jest.spyOn(DatabaseUtils, 'getWorker').mockResolvedValueOnce(getWorkerMock)
        jest.spyOn(DatabaseUtils, 'getIntegratorGroup').mockResolvedValueOnce(getIntegratorGroupMock)
        jest.spyOn(DatabaseUtils, 'checkIfUserIsInGroup').mockResolvedValueOnce({error: '', code: 500})
        const result = await DatabaseUtils.addUserToIntegratorGroup('test', 'test', 'test', 'test')
        if('error' in result){
            expect(result.error).toMatch('Error in userAlreadyInGroup: ')
        }
    })

    it('should return success', async () => {
        jest.spyOn(DatabaseUtils, 'getWorker').mockResolvedValueOnce(getWorkerMock)
        jest.spyOn(DatabaseUtils, 'getIntegratorGroup').mockResolvedValueOnce(getIntegratorGroupMock)
        jest.spyOn(DatabaseUtils, 'checkIfUserIsInGroup').mockResolvedValueOnce(checkIfUserIsInGroupMock)
        DynamoDBClient.prototype.send = jest.fn().mockResolvedValueOnce({})
        const result = await DatabaseUtils.addUserToIntegratorGroup('test', 'test', 'test', 'test')
        expect(result).toEqual(successMock)
    })
})
describe('checkIfUserIsInGroup tests', () => {

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('should error when user is in group', async () => {
        DynamoDBClient.prototype.send = jest.fn().mockResolvedValueOnce({Item: []})
        const result = await DatabaseUtils.checkIfUserIsInGroup('test', 'test')
        if('error' in result){
            expect(result.error).toMatch('User test already in group test')
        }
    })

    it('should return success', async () => {
        DynamoDBClient.prototype.send = jest.fn().mockResolvedValueOnce({})
        const result = await DatabaseUtils.checkIfUserIsInGroup('test', 'test')
        if('error' in result){
            expect(result.error).toMatch('User test not in group test')
        }
    })
})
describe('createIntegratorGroup tests', () => {

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('should return an error when user is not a service user or a manager', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(workerByIDMock)
        const result = await DatabaseUtils.createIntegratorGroup('test', 'test', 'test')
        if('error' in result){
            expect(result.error).toMatch('User is neither a service user nor a manager')
        }
    })

    it('should return an error when service user tries to add a group for a non manager', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(serviceByIDMock).mockResolvedValueOnce(workerByIDMock)
        DynamoDBClient.prototype.send = jest.fn().mockResolvedValueOnce({})
        const result = await DatabaseUtils.createIntegratorGroup('test', 'test', 'test')
        if('error' in result){
            expect(result.error).toMatch('Cannot add an integrator group for a non manager')
        }
    })

    it('should return an error when user is not a service user or a manager', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(managerByIDMock)
        jest.spyOn(DatabaseUtils, 'generateId').mockReturnValueOnce('test')
        DynamoDBClient.prototype.send = jest.fn().mockResolvedValueOnce({})
        const result = await DatabaseUtils.createIntegratorGroup('test', 'test', 'test')
        expect(result).toEqual(createIntegratorGroupSuccessMock)
    })
})
describe('addIntegratorToGroup tests', () => {

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('should return an error when getIntegrator errors', async () => {
        jest.spyOn(DatabaseUtils, 'getIntegrator').mockResolvedValueOnce({error: '', code: 500})
        const result = await DatabaseUtils.addIntegratorToGroup('test', 'test', 'test', 'test')
        if('error' in result){
            expect(result.error).toMatch('Error in managerHasIntegratorWithID: ')
        }
    })

    it('should return an error when getIntegratorGroup errors', async () => {
        jest.spyOn(DatabaseUtils, 'getIntegrator').mockResolvedValueOnce(getIntegratorMock)
        jest.spyOn(DatabaseUtils, 'getIntegratorGroup').mockResolvedValueOnce({error: '', code: 500})
        const result = await DatabaseUtils.addIntegratorToGroup('test', 'test', 'test', 'test')
        if('error' in result){
            expect(result.error).toMatch('Error in managerHasGroupWithID: ')
        }
    })

    it('should return an error when checkIfUserIsInGroup errors', async () => {
        jest.spyOn(DatabaseUtils, 'getIntegrator').mockResolvedValueOnce(getIntegratorMock)
        jest.spyOn(DatabaseUtils, 'getIntegratorGroup').mockResolvedValueOnce(getIntegratorGroupMock)
        jest.spyOn(DatabaseUtils, 'checkIfIntegratorIsInGroup').mockResolvedValueOnce({error: '', code: 500})
        const result = await DatabaseUtils.addIntegratorToGroup('test', 'test', 'test', 'test')
        if('error' in result){
            expect(result.error).toMatch('Error in integratorAlreadyInGroup: ')
        }
    })

    it('should return success', async () => {
        jest.spyOn(DatabaseUtils, 'getIntegrator').mockResolvedValueOnce(getIntegratorMock)
        jest.spyOn(DatabaseUtils, 'getIntegratorGroup').mockResolvedValueOnce(getIntegratorGroupMock)
        jest.spyOn(DatabaseUtils, 'checkIfIntegratorIsInGroup').mockResolvedValueOnce(checkIfIntegratorIsInGroupMock)
        DynamoDBClient.prototype.send = jest.fn().mockResolvedValueOnce({})
        const result = await DatabaseUtils.addIntegratorToGroup('test', 'test', 'test', 'test')
        expect(result).toEqual(addIntegratorToGroupsuccessMock)
    })
})
describe('getIntegratorGroups tests', () => {

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('should return an error when getWorker returns an error', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(managerByIDMock)
        jest.spyOn(DatabaseUtils, 'getWorker').mockResolvedValueOnce({error: '', code: 500})
        const result = await DatabaseUtils.getIntegratorGroups('test', 'manager')
        if('error' in result){
            expect(result.error).toMatch('Error getting worker: ')
        }
    })

    it('should return an error when result.Items is not present', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(managerByIDMock)
        jest.spyOn(DatabaseUtils, 'getWorker').mockResolvedValueOnce(workerByIDMock)
        DynamoDBClient.prototype.send = jest.fn().mockResolvedValueOnce({})
        const result = await DatabaseUtils.getIntegratorGroups('test', 'manager')
        if('error' in result){
            expect(result.error).toMatch('No result.Items')
        }
    })

    it('should return an error when batchGetItemResult.Responses is not present', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(managerByIDMock)
        jest.spyOn(DatabaseUtils, 'getWorker').mockResolvedValueOnce(workerByIDMock)
        DynamoDBClient.prototype.send = jest.fn().mockResolvedValueOnce(resultItemsGetIntegratorGroupsMock).mockResolvedValueOnce({})
        const result = await DatabaseUtils.getIntegratorGroups('test', 'manager')
        if('error' in result){
            expect(result.error).toMatch('Could not get batchGetItemResult.Responses for test')
        }
    })

    it('should return success', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(managerByIDMock)
        jest.spyOn(DatabaseUtils, 'getWorker').mockResolvedValueOnce(workerByIDMock)
        DynamoDBClient.prototype.send = jest.fn().mockResolvedValueOnce(resultItemsGetIntegratorGroupsMock).mockResolvedValueOnce(batchGetItemsGetIntegratorGroupsMock)
        const result = await DatabaseUtils.getIntegratorGroups('test', 'manager')
        expect(result).toEqual(getIntegratorGroupsSuccessMock)
    })
})
describe('getIntegratorGroup tests', () => {

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('should return an error when user is not a service user or a manager', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(workerByIDMock)
        const result = await DatabaseUtils.getIntegratorGroup('test', 'test', 'test')
        if('error' in result){
            expect(result.error).toMatch('User is neither a service user nor a manager')
        }
    })

    it('should return an error when manager does not have a worker with this id', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(managerByIDMock)
        DynamoDBClient.prototype.send = jest.fn().mockResolvedValueOnce({})
        const result = await DatabaseUtils.getIntegratorGroup('test', 'test', 'test')
        if('error' in result){
            expect(result.error).toMatch('Manager does not have an integrator group with this id: test')
        }
    })

    it('should return success', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(managerByIDMock)
        DynamoDBClient.prototype.send = jest.fn().mockResolvedValueOnce({ Item: { PK: { S: 'test' }, SK: { S: 'group#test' } } })
        const result = await DatabaseUtils.getIntegratorGroup('test', 'test', 'test')
        expect(result).toEqual({ PK: 'test', SK: 'group#test' })
    })
})
describe('getIntegratorsFromGroups tests', () => {

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('should return an error when manager does not have a worker', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(managerByIDMock)
        jest.spyOn(DatabaseUtils, 'getWorker').mockResolvedValueOnce({error: '', code: 500})
        const result = await DatabaseUtils.getIntegratorsFromGroups('manager', 'test', ['group1'])
        if('error' in result){
            expect(result.error).toMatch('Error getting worker: ')
        }
    })

    it('should return an error when getIntegratorGroups fails', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(managerByIDMock)
        jest.spyOn(DatabaseUtils, 'getIntegratorGroups').mockResolvedValueOnce({error: '', code: 500})
        const result = await DatabaseUtils.getIntegratorsFromGroups('manager', 'manager', ['group1'])
        if('error' in result){
            expect(result.error).toMatch('Error getting userGroups: ')
        }
    })

    it('should return an error when getIntegratorGroups fails', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(managerByIDMock)
        jest.spyOn(DatabaseUtils, 'getIntegratorGroups').mockResolvedValueOnce([{PK: 'group1', SK: 'group', integratorGroupName: 'group'}])
        const result = await DatabaseUtils.getIntegratorsFromGroups('manager', 'manager', ['group'])
        if('error' in result){
            expect(result.error).toMatch('User not in group: group')
        }
    })

    it('should return an error when getIntegratorsCommand fails', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(managerByIDMock)
        jest.spyOn(DatabaseUtils, 'getIntegratorGroups').mockResolvedValueOnce([{PK: 'group1', SK: 'group', integratorGroupName: 'group'}])
        DynamoDBClient.prototype.send = jest.fn().mockResolvedValueOnce(resultItemsGetIntegratorsFromGroupsMock).mockResolvedValueOnce(resultItemsGetIntegratorsFromGroupsEmptyResponsesMock)
        const result = await DatabaseUtils.getIntegratorsFromGroups('manager', 'manager', ['group1'])
        if('error' in result){
            expect(result.error).toMatch('Could not get batchGetItemResult.Responses for manager')
        }
    })

    it('should return success', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(managerByIDMock)
        jest.spyOn(DatabaseUtils, 'getIntegratorGroups').mockResolvedValueOnce([{PK: 'group1', SK: 'group', integratorGroupName: 'group'}])
        DynamoDBClient.prototype.send = jest.fn().mockResolvedValueOnce(getIntegratorsInGroupMock).mockResolvedValueOnce(resultItemsGetIntegratorsFromGroupsSuccessMock)
        const result = await DatabaseUtils.getIntegratorsFromGroups('manager', 'manager', ['group1'])
        expect(result).toEqual(GetIntegratorsFromGroupsSuccessObjectMock)
    })
})
describe('checkIfIntegratorIsInGroup tests', () => {

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('should return an error when manager does not have a worker with this id', async () => {
        DynamoDBClient.prototype.send = jest.fn().mockResolvedValueOnce({Item: {}})
        const result = await DatabaseUtils.checkIfIntegratorIsInGroup('testGroup', 'testIntegrator')
        if('error' in result){
            expect(result.error).toMatch('Integrator testIntegrator already in group testGroup')
        }
    })

    it('should return success', async () => {
        DynamoDBClient.prototype.send = jest.fn().mockResolvedValueOnce({})
        const result = await DatabaseUtils.checkIfIntegratorIsInGroup('testGroup', 'testIntegrator')
        if('success' in result){
            expect(result.success).toMatch('Integrator testIntegrator not in group testGroup')
        }
    })
})
describe('createEntries tests', () => {

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('should return an error when user is not a service user', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(workerByIDMock)
        const result = await DatabaseUtils.createEntries('testCreator', 'testUser', 'testIntegrator', [])
        if('error' in result){
            expect(result.error).toMatch('User is not a service user')
        }
    })

    it('should return an error when managerHasIntegrator fails', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(serviceByIDMock)
        jest.spyOn(DatabaseUtils, 'getIntegrator').mockResolvedValueOnce({error: '', code: 500})
        const result = await DatabaseUtils.createEntries('testCreator', 'testUser', 'testIntegrator', [])
        if('error' in result){
            expect(result.error).toMatch('Error in managerHasIntegrator: ')
        }
    })

    it('should return an error when an entry has totalCrushed less or equal to 0', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(serviceByIDMock)
        jest.spyOn(DatabaseUtils, 'getIntegrator').mockResolvedValueOnce({PK: 'testUser', SK: 'integrator#test'})
        const result = await DatabaseUtils.createEntries(
            'testCreator',
            'testUser',
            'testIntegrator',
            [{PK: 'testPK', SK: 'testSK', totalCrushed: 0}])
        if('error' in result){
            expect(result.error).toMatch('totalCrushed must be greater than 0!')
        }
    })
    it('should return success', async () => {
        jest.spyOn(DatabaseUtils, 'getUserByID').mockResolvedValueOnce(serviceByIDMock)
        jest.spyOn(DatabaseUtils, 'getIntegrator').mockResolvedValueOnce({PK: 'testUser', SK: 'integrator#test'})
        DynamoDBClient.prototype.send = jest.fn().mockResolvedValueOnce({})
        const result = await DatabaseUtils.createEntries(
            'testCreator',
            'testUser',
            'testIntegrator',
            [{PK: 'testPK', SK: 'testSK', totalCrushed: 10}])
        if('success' in result){
            expect(result.success).toMatch('Successfully added entries')
        }
    })
})


