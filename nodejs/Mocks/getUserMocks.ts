export const workerMock = {
    Item: {
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
}
export const managerMock = {
    Item: {
        PK: { S: 'userID123' },
        SK: { S: 'user' },
        email: { S: 'user@user.com'},
        role: {
            M: {
                isManager: {
                    BOOL: true
                },
                isService: {
                    BOOL: false
                }
            }
        }
    }
}
export const serviceUserMock = {
    Item: {
        PK: { S: 'userID123' },
        SK: { S: 'user' },
        email: { S: 'user@user.com'},
        role: {
            M: {
                isManager: {
                    BOOL: true
                },
                isService: {
                    BOOL: true
                }
            }
        }
    }
}
