import {InitiateAuthCommandOutput} from "@aws-sdk/client-cognito-identity-provider";

// @ts-ignore
export const initiateAuthNewPwdMock = {
    ChallengeName: 'NEW_PASSWORD_REQUIRED',
    ChallengeParameters: {'userAttributes': 'attributes'},
    Session: 'session'
} as InitiateAuthCommandOutput

export const initiateAuthNoTokensMock = {
    AuthenticationResult: {}
} as InitiateAuthCommandOutput

export const initiateAuthSuccessMock = {
    AuthenticationResult: {
        AccessToken: 'accessToken',
        IdToken: 'idToken'
    }
} as InitiateAuthCommandOutput


