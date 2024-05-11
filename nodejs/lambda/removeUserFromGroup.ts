import {APIGatewayEvent} from "aws-lambda";
import {removeUserFromGroup} from "./Utils/DatabaseUtils";
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

        const {integratorGroupID, removedUserID, managerID} = JSON.parse(event.body || '')

        const removeUserFromGroupRequest = await removeUserFromGroup(creatorID, managerID, removedUserID, integratorGroupID)

        if('error' in removeUserFromGroupRequest){
            console.error('Error in removeUserFromGroupRequest: ' + removeUserFromGroupRequest.error)
            return response(removeUserFromGroupRequest.code, removeUserFromGroupRequest.error)
        }
        return response(200, removeUserFromGroupRequest)

    }
    catch (e) {
        console.error('Internal server error', e)
        return response()
    }
}