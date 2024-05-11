export const resultItemsGetIntegratorGroupsMock = {
    Items: []
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
export const getIntegratorGroupsSuccessMock = [{
    PK: 'test',
    SK: 'group',
    integratorGroupName: 'test'
}]