import {APIGatewayEvent} from "aws-lambda";
import {editIntegrator} from "./Utils/DatabaseUtils";
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

        const editIntegratorResult = await editIntegrator(requesterID, userID, editData)

        if('error' in editIntegratorResult){
            console.error('Error in editIntegratorResult: ' + editIntegratorResult.error)
            console.error('Request: ', JSON.stringify(event.body, null, 2))
            return response(editIntegratorResult.code, editIntegratorResult.error)
        }

        return response(200, editIntegratorResult)

    }
    catch (e) {
        console.error('Error: ', e)
        console.error('Request: ', JSON.stringify(event.body, null, 2))
        return response()
    }
}