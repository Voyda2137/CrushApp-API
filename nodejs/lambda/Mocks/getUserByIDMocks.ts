import {CognitoAttributes} from "../Enums/CognitoAttributes"

export const workerByIDMock = {
    PK: 'worker',
    SK: 'user',
    role: {
        isService: false,
        isManager: false
    },
    cognitoAttributes: [
        {
            Name: CognitoAttributes.EMAIL,
            Value: 'user@user.com'
        }
    ]
}
export const serviceByIDMock = {
    PK: 'service',
    SK: 'user',
    role: {
        isService: true,
        isManager: false
    },
    cognitoAttributes: [
        {
            Name: CognitoAttributes.EMAIL,
            Value: 'user@user.com'
        }
    ]
}
export const managerByIDMock = {
    PK: 'manager',
    SK: 'user',
    role: {
        isService: false,
        isManager: true
    },
    cognitoAttributes: [
        {
            Name: CognitoAttributes.EMAIL,
            Value: 'user@user.com'
        }
    ]
}