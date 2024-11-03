import {APIGatewayEvent} from "aws-lambda";
import {getGroupsForUsers, getIntegratorGroups} from "./Utils/DatabaseUtils";
import {checkIfTokenMatchesGivenID} from "./Utils/UserUtils";
import {response} from "./Constants/response";

exports.handler = async(event: APIGatewayEvent) => {
    try {
        if (event.httpMethod === 'OPTIONS') {
            return response(200, '')
        }
        const requesterID = event.pathParameters?.userID

        if(!requesterID){
            console.error('requesterID not provided in path parameters');
            return response(400, 'requesterID not provided in path parameters')
        }

        const auth = event.headers?.Authorization || ''

        const authMatchesUserID = await checkIfTokenMatchesGivenID(requesterID, auth)

        if('error' in authMatchesUserID){
            console.error('Token does not match creatorID')
            return response(403, 'Token does not match creatorID')
        }

        const mappedGroups = await getGroupsForUsers(requesterID)

        if('error' in mappedGroups){
            console.error('Error in integratorGroups: ' + mappedGroups.error)
            console.error('Request: ', JSON.stringify(event.body, null, 2))
            return response(mappedGroups.code, mappedGroups.error)
        }

        return response(200, {groupsForUsers: mappedGroups})

    }
    catch (e) {
        console.error('Error: ', e)
        console.error('Request: ', JSON.stringify(event, null, 2))
        return response()
    }
}