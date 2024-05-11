import {APIGatewayEvent} from "aws-lambda";
import {editUser} from "./Utils/DatabaseUtils";
import {checkIfTokenMatchesGivenID} from "./Utils/UserUtils";
import {response} from "./Constants/response";

exports.handler = async(event: APIGatewayEvent) => {
    try {
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

        const { userID, editData } = JSON.parse(event.body || '')

        const editUserResult = await editUser(requesterID, userID, editData)

        if('error' in editUserResult){
            console.error('Error in editUserResult: ' + editUserResult.error)
            return response(editUserResult.code, editUserResult.error)
        }

        return response(200, editUserResult)

    }
    catch (e) {
        console.error('Error: ', e)
        return response()
    }
}