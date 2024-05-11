import {APIGatewayEvent} from "aws-lambda";
import {getIntegratorGroups} from "./Utils/DatabaseUtils";
import {checkIfTokenMatchesGivenID} from "./Utils/UserUtils";
import {response} from "./Constants/response";

exports.handler = async(event: APIGatewayEvent) => {
    try {
        if (event.httpMethod === 'OPTIONS') {
            return response(200, '')
        }
        const requesterID = event.pathParameters?.userID
        const userID = event.queryStringParameters?.groupsFor || ''

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

        const integratorGroups = await getIntegratorGroups(userID, requesterID)

        if('error' in integratorGroups){
            console.error('Error in integratorGroups: ' + integratorGroups.error)
            return response(integratorGroups.code, integratorGroups.error)
        }

        return response(200, {integratorGroups: integratorGroups})

    }
    catch (e) {
        console.error('Error: ', e)
        return response()
    }
}