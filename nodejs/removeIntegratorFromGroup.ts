import {APIGatewayEvent} from "aws-lambda";
import {removeIntegratorFromGroup} from "./Utils/DatabaseUtils";
import {response} from "./Constants/response";
import {checkIfTokenMatchesGivenID} from "./Utils/UserUtils";

exports.handler = async (event: APIGatewayEvent) => {
    try {

        const creatorID = event.pathParameters?.userID

        const auth = event.headers?.Authorization || ''

        if(!creatorID){
            console.error('creatorID not provided in path parameters');
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'creatorID not provided in path parameters' }, null, 2)
            };
        }

        const authMatchesUserID = await checkIfTokenMatchesGivenID(creatorID, auth)

        if('error' in authMatchesUserID){
            console.error('Token does not match creatorID')
            return response(403, 'Token does not match creatorID')
        }

        const {integratorID, integratorGroupID, managerID} = JSON.parse(event.body || '')
        const removeIntegratorFromGroupRequest = await removeIntegratorFromGroup(creatorID, managerID, integratorID, integratorGroupID)

        if('error' in removeIntegratorFromGroupRequest){
            console.error('Error in removeIntegratorFromGroupRequest: ' + removeIntegratorFromGroupRequest.error)
            console.error('Request: ', JSON.stringify(event.body, null, 2))
            return response(removeIntegratorFromGroupRequest.code, removeIntegratorFromGroupRequest.error)
        }
        return response(200, removeIntegratorFromGroupRequest)

    }
    catch(e) {
        console.error('Error catched: ', e)
        console.error('Request: ', JSON.stringify(event.body, null, 2))
        return response()
    }
}