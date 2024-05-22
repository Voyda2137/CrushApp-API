export const resultItemsGetIntegratorsFromGroupsMock = {
    Items: []
}
export const resultItemsGetIntegratorsFromGroupsEmptyResponsesMock = {
    Responses: {}
}
export const getIntegratorsInGroupMock = {
    Items: [
        { PK: { S: 'group1' }, SK: { S: 'integrator#integrator1'} }
    ]
}
export const resultItemsGetIntegratorsFromGroupsSuccessMock = {
    Responses: {
        ['']: [
            {
                PK: { S: 'integrator1' },
                SK: { S: 'integrator' },
                location: { S: 'location' },
                serialNumber: { S: 'serial' }
            }
        ]
    }
}
export const GetIntegratorsFromGroupsSuccessObjectMock = [{
    group1: [{
        PK: 'integrator1',
        SK: 'integrator',
        isDeletedFromGroup: false,
        location: 'location',
        serialNumber: 'serial'
    }]
}]