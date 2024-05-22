import {createIntegrator} from "./Utils/DatabaseUtils";
import {APIGatewayEvent} from "aws-lambda";
import {checkIfTokenMatchesGivenID} from "./Utils/UserUtils";
import {response} from "./Constants/response";

exports.handler = async (event: APIGatewayEvent) => {
    try{

        const creatorID = event.pathParameters?.userID

        const auth = event.headers?.Authorization || ''

        if(!creatorID){
            console.error('creatorID not provided in path parameters');
            return response(400, 'creatorID not provided in path parameters')
        }

        const authMatchesUserID = await checkIfTokenMatchesGivenID(creatorID, auth)

        if('error' in authMatchesUserID){
            console.error('Token does not match creatorID')
            return response(403, 'Token does not match creatorID')
        }

        const {location, serialNumber, userID} = JSON.parse(event.body || '')

        const createIntegratorRequest = await createIntegrator({location: location, serialNumber: serialNumber, userID: userID, creatorID: creatorID})
        if('error' in createIntegratorRequest){
            console.error('Error in createIntegratorRequest: ', createIntegratorRequest.error)
            console.error('Request: ', JSON.stringify(event.body, null, 2))
            return response(createIntegratorRequest.code, createIntegratorRequest.error)
        }
        return response(200, createIntegratorRequest)
    }
    catch (e) {
        console.error('Error adding integrator: ', e)
        console.error('Request: ', JSON.stringify(event.body, null, 2))
        return response()
    }
}