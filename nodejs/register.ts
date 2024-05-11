import {createUser} from "./Utils/DatabaseUtils";
import {checkIfTokenMatchesGivenID} from "./Utils/UserUtils"
import {APIGatewayEvent} from "aws-lambda";
import {IRegisterUser} from "./Interfaces/IRegisterUser";
import {response} from "./Constants/response";

exports.handler = async (event: APIGatewayEvent) => {
    try {
        const creatorID = event.pathParameters?.creatorID

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

        const userObject: IRegisterUser = JSON.parse(event.body || '')
        const createUserRequest = await createUser(userObject, creatorID)

        if('error' in createUserRequest){
            console.error('Error in createUserRequest: ', JSON.stringify(createUserRequest, null, 2))
            return response(createUserRequest.code, createUserRequest.error)
        }
        return response(200, 'Successfully created user!')
    }
    catch (e) {
        console.error('Error creating user: ', JSON.stringify(e, null, 2))
        return response()
    }
}
