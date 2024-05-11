import {APIGatewayEvent} from "aws-lambda";
import {createEntries} from "./Utils/DatabaseUtils";
import {response} from "./Constants/response";
import {checkIfTokenMatchesGivenID} from "./Utils/UserUtils";

exports.handler = async (event: APIGatewayEvent) => {
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

        const {userID, integratorEntries, integratorID} = JSON.parse(event.body || '')

        const createEntriesRequest = await createEntries(requesterID, userID, integratorID, integratorEntries)

        if('error' in createEntriesRequest){
            console.error('error in createEntriesRequest: ' + createEntriesRequest.error)
            return response(createEntriesRequest.code, createEntriesRequest.error)
        }
        return response(200, 'Successfully added entries')
    }
    catch (e) {
        console.error('Error while adding entries: ' + e)
        return response()
    }
}