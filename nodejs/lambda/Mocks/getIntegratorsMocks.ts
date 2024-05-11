export const resultItemsGetIntegratorsMock = {
    Items: []
}
export const batchGetItemsMock = {
    Responses: {
        ['']: [
            {
                PK: { S: 'test' },
                SK: { S: 'integrator' },
                location: { S: 'location' },
                serialNumber: { S: 'serial' }
            }
        ]
    }
}
export const successObjectMock = [{
    PK: 'test',
    SK: 'integrator',
    location: 'location',
    serialNumber: 'serial'
}]