import {changeUserPassword} from "./Utils/DatabaseUtils";
import {APIGatewayEvent} from "aws-lambda";
import {response} from "./Constants/response";
import {checkIfTokenMatchesGivenID} from "./Utils/UserUtils";

exports.handler = async (event: APIGatewayEvent) => {
    try {
        const userID = event.pathParameters?.userID

        const auth = event.headers?.Authorization || ''

        const { password } = JSON.parse(event.body || '')

        if(!userID){
            console.error('userID not provided in path parameters');
            return response(400, 'userID not provided in path parameters')
        }

        const authMatchesUserID = await checkIfTokenMatchesGivenID(userID, auth)

        if('error' in authMatchesUserID){
            console.error('Token does not match creatorID')
            return response(403, 'Token does not match creatorID')
        }

        if(password && userID){

            const changePasswordRequest = await changeUserPassword(userID, password)

            if('error' in changePasswordRequest) {
                console.error('Error changing password: ', JSON.stringify(changePasswordRequest.error, null, 2))
                return response(changePasswordRequest.code, changePasswordRequest.error)
            }

            return response(200, 'Succesfully changed user password')
        }
        else {
            console.error('No password or username')
            return response(400, 'No password or username')
        }
    }
    catch (e) {
        console.error('Error: ', e)
        return response()
    }
}
