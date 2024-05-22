import {APIGatewayEvent} from "aws-lambda";
import {createIntegratorGroup} from "./Utils/DatabaseUtils";
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

        const {integratorGroupName, userID} = JSON.parse(event.body || '')
        const createIntegratorGroupRequest = await createIntegratorGroup(integratorGroupName, creatorID, userID)
        if('error' in createIntegratorGroupRequest){
            console.error('Error in createIntegratorGroupRequest: ', createIntegratorGroupRequest.error)
            console.error('Request: ', JSON.stringify(event.body, null, 2))
            return response(createIntegratorGroupRequest.code, createIntegratorGroupRequest.error)
        }
        return response(200, createIntegratorGroupRequest)
    }
    catch (e) {
        console.error("Error: ", e)
        console.error('Request: ', JSON.stringify(event.body, null, 2))
        return response()
    }
}