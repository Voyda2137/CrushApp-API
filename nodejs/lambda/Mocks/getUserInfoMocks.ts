import {CognitoAttributes} from "../Enums/CognitoAttributes";

export const noAttributesMock = {}
export const userInfoSuccessMock = {
    UserAttributes: {
        Name: CognitoAttributes.EMAIL,
        Value: 'user@user.com'
    }
}