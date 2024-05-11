import {APIGatewayEvent} from "aws-lambda";
import {getIntegratorsFromGroups} from "./Utils/DatabaseUtils";
import {checkIfTokenMatchesGivenID} from "./Utils/UserUtils";
import {response} from "./Constants/response";

exports.handler = async(event: APIGatewayEvent) => {
    try {
        if (event.httpMethod === 'OPTIONS') {
            return response(200, '')
        }
        const requesterID = event.pathParameters?.userID
        const userID = event.queryStringParameters?.groupsFor || ''
        const groupsParam = event.queryStringParameters?.groups || ''

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

        if(!groupsParam){
            console.error('groups not provided in queryString');
            return response(400, 'groups not provided in queryString')
        }
        const groups: string[] = groupsParam.split(',')

        console.log('groups: ' + groups)

        const integratorsInGroups = await getIntegratorsFromGroups(requesterID, userID, groups)

        if('error' in integratorsInGroups){
            console.error('Error in getIntegrators: ' + integratorsInGroups.error)
            return response(integratorsInGroups.code, integratorsInGroups.error)
        }

        return response(200, {integratorsInGroups: integratorsInGroups})

    }
    catch (e) {
        console.error('Error: ', e)
        return response()
    }
}