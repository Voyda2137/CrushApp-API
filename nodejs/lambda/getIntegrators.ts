import {APIGatewayEvent} from "aws-lambda";
import {getIntegrators} from "./Utils/DatabaseUtils";
import {checkIfTokenMatchesGivenID} from "./Utils/UserUtils";
import {response} from "./Constants/response";

exports.handler = async(event: APIGatewayEvent) => {
    try {
        if (event.httpMethod === 'OPTIONS') {
            return response(200, '')
        }
        const userID = event.pathParameters?.userID
        const integratorsOwnerID = event.queryStringParameters?.createdFor || ''

        if(!userID){
            console.error('userID not provided in path parameters');
            return response(400, 'userID not provided in path parameters')
        }

        const auth = event.headers?.Authorization || ''

        const authMatchesUserID = await checkIfTokenMatchesGivenID(userID, auth)

        if('error' in authMatchesUserID){
            console.error('Token does not match creatorID')
            return response(403, 'Token does not match creatorID')
        }
        const integrators = await getIntegrators(userID, integratorsOwnerID)
        return response(200, {integrators: integrators})

    }
    catch (e) {
        console.error('Error: ', e)
        return response()
    }
}