export const emptyResponsesMock = {
    Responses: {
        ['']: [

        ]
    }
}
export const filledResponsesMock = {
    Responses: {
        ['']: [
            {
                PK: { S: 'userID123' },
                SK: { S: 'user' },
                email: { S: 'user@user.com'},
                role: {
                    M: {
                        isManager: {
                            BOOL: false
                        },
                        isService: {
                            BOOL: false
                        }
                    }
                }
            }
        ]
    }
}
export const successResponseMock = [{
    PK: 'userID123',
    SK: 'user',
    email: 'user@user.com',
    role: {
        isManager: false,
        isService: false
    }
}]