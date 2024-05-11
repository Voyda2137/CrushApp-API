import {CognitoAttributes} from "../Enums/CognitoAttributes"

export const createUserMock = {
    username: "user@user.com",
    userAttributes: [
        {
            Name: CognitoAttributes.EMAIL,
            Value: "user@user.com"
        }
    ],
    manager: "manager",
    role: {
        isService: false,
        isManager: false
    }
}
export const createServiceUserMock = {
    username: "user@user.com",
    userAttributes: [
        {
            Name: CognitoAttributes.EMAIL,
            Value: "user@user.com"
        }
    ],
    role: {
        isService: true,
        isManager: false
    }
}
export const createUserWithNoUsernameMock = {
    userAttributes: [
        {
            Name: CognitoAttributes.EMAIL,
            Value: "user@user.com"
        }
    ],
    role: {
        isService: false,
        isManager: false
    }
}
export const createUserWithNoManagerMock = {
    username: "user@user.com",
    userAttributes: [
        {
            Name: CognitoAttributes.EMAIL,
            Value: "user@user.com"
        }
    ],
    role: {
        isService: false,
        isManager: false
    }
}
export const createManagerWithManagerMock = {
    username: "user@user.com",
    manager: 'manager',
    userAttributes: [
        {
            Name: CognitoAttributes.EMAIL,
            Value: "user@user.com"
        }
    ],
    role: {
        isService: false,
        isManager: true
    }
}
export const createUserWithNoUserAttributesMock = {
    username: "user@user.com",
    manager: 'userID123',
    userAttributes: [],
    role: {
        isService: false,
        isManager: false
    }
}
export const createUserWithEmailNotMatchingUsernameMock = {
    username: "user@user.com",
    manager: 'userID123',
    userAttributes: [
        {
            Name: CognitoAttributes.EMAIL,
            Value: "user@user"
        }
    ],
    role: {
        isService: false,
        isManager: false
    }
}
export const createUserWithNoAttributesFoundInCognitoMock = {
    username: "user@user.com",
    manager: 'userID123',
    userAttributes: [
        {
            Name: CognitoAttributes.EMAIL,
            Value: "user@user.com"
        }
    ],
    role: {
        isService: false,
        isManager: false
    }
}
export const createUserSuccessMock = {
    username: "user@user.com",
    manager: 'userID123',
    userAttributes: [
        {
            Name: CognitoAttributes.EMAIL,
            Value: "user@user.com"
        }
    ],
    role: {
        isService: false,
        isManager: false
    }
}
export const createUserSuccessCognitoMock = {
    User: {
        Attributes: [{ Name: 'sub', Value: 'subMock' }]
    }
}
export const createUserSuccessReturnMock = {
    PK: 'subMock',
    role: {
        isService: false,
        isManager: false
    },
    cognitoAttributes: [
        {
            Name: CognitoAttributes.EMAIL,
            Value: "user@user.com"
        }
    ]
}