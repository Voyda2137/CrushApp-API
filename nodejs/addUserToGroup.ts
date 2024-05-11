import {APIGatewayEvent} from "aws-lambda";
import {addUserToIntegratorGroup} from "./Utils/DatabaseUtils";
import {response} from "./Constants/response";
import {checkIfTokenMatchesGivenID} from "./Utils/UserUtils";

exports.handler = async (event: APIGatewayEvent) => {
    try {
        const creatorID = event.pathParameters?.userID

        const auth = event.headers?.Authorization || ''

        if(!creatorID){
            console.error('creatorID not provided in path parameters');
            return response(400, 'creatorID not provided in path parameters')
        }

        const authMatchesUserID = await checkIfTokenMatchesGivenID(creatorID, auth)

        if('error' in authMatchesUserID){
            console.error('Token does not match creatorID')
            return response(403, 'Token does not match creatorID')
        }

        const {integratorGroupID, addedUserID, managerID} = JSON.parse(event.body || '')

        const addUserToGroupRequest = await addUserToIntegratorGroup(integratorGroupID, creatorID, managerID, addedUserID)

        if('error' in addUserToGroupRequest){
            console.error('Error in addUserToGroupRequest: ' + addUserToGroupRequest.error)
            return response(addUserToGroupRequest.code, addUserToGroupRequest.error)
        }
        return response(200, addUserToGroupRequest)

    }
    catch (e) {
        console.error('Internal server error', e)
        return response()
    }
}