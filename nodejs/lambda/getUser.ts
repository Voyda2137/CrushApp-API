import {APIGatewayEvent} from "aws-lambda";
import {getUserInfo} from "./Utils/DatabaseUtils";
import {checkIfTokenMatchesGivenID} from "./Utils/UserUtils";
import {response} from "./Constants/response";

exports.handler = async(event: APIGatewayEvent) => {
    try {
        if (event.httpMethod === 'OPTIONS') {
            return response(200, '')
        }

        const requesterID = event.pathParameters?.userID
        const userID = event.queryStringParameters?.userID

        if(!requesterID){
            console.error('requesterID not provided in path parameters');
            return response(400, 'requesterID not provided in path parameters')
        }

        if(!userID){
            console.error('userID not provided in path parameters');
            return response(400, 'userID not provided in path parameters')
        }

        const auth = event.headers?.Authorization || ''

        const authMatchesUserID = await checkIfTokenMatchesGivenID(requesterID, auth)

        if('error' in authMatchesUserID){
            console.error('Token does not match creatorID')
            return response(403, 'Token does not match creatorID')
        }

        const getUser = await getUserInfo(userID, requesterID)

        if('error' in getUser){
            console.error('Error from getUser: ' + getUser.error)
            return response()
        }

        return response(200, {user: getUser})

    }
    catch (e) {
        console.error('Error in getUser ', e)
        return response()
    }
}