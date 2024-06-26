import {APIGatewayEvent} from "aws-lambda";
import {getWorkers} from "./Utils/DatabaseUtils";
import {checkIfTokenMatchesGivenID} from "./Utils/UserUtils";
import {response} from "./Constants/response";

exports.handler = async(event: APIGatewayEvent) => {
    try {
        if (event.httpMethod === 'OPTIONS') {
            return response(200, '')
        }

        const userID = event.pathParameters?.userID

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

        const workers = await getWorkers(userID)
        if('error' in workers){
            console.error('Error in workers function', workers.error)
            console.error('Request: ', JSON.stringify(event.body, null, 2))
            return response(workers.code, workers.error)
        }
        return response(200, {workers: workers})
    }
    catch (e) {
        console.error('Error ', e)
        console.error('Request: ', JSON.stringify(event.body, null, 2))
        return response()
    }
}