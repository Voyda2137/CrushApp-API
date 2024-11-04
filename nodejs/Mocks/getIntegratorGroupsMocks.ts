export const resultItemsGetIntegratorGroupsMock = {
    Items: [
        {
            PK: { S: 'testIntegratorGroup' },
            SK: { S: 'testIntegratorID'}
        }
    ]
}
export const batchGetItemsGetIntegratorGroupsMock = {
    Responses: {
        ['']: [
            {
                PK: { S: 'test' },
                SK: { S: 'group' },
                integratorGroupName: { S: 'test' }
            }
        ]
    }
}
export const checkIfUserHasGroupMock = {
    PK: 'test',
    SK: 'group'
}
export const getIntegratorGroupsSuccessMock = [{
    PK: 'test',
    SK: 'group',
    integratorGroupName: 'test'
}]