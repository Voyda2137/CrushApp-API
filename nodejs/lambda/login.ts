import {userLogin} from "./Utils/DatabaseUtils";
import {APIGatewayEvent} from "aws-lambda";
import {response} from "./Constants/response";
import {ILoginRequest} from "./Interfaces/ILoginRequest";

exports.handler = async (event: APIGatewayEvent) => {
    try {
        const userObject: ILoginRequest = JSON.parse(event.body || '')
        if(userObject.username && userObject.password){
            const loginRequest = await userLogin({username: userObject.username, password: userObject.password })

            if('error' in loginRequest){
                console.error('Error logging in: ', JSON.stringify(loginRequest.error, null, 2))
                return response(500)
            }

            if('challengeName' in loginRequest) {
                return response(200, {
                    challengeName: loginRequest.challengeName,
                    challengeParameters: loginRequest.challengeParameters,
                    session: loginRequest.session
                })
            }
            else {
                return response(200, {
                    userID: loginRequest.sub,
                    id_token: loginRequest.id_token,
                    access_token: loginRequest.access_token
                })
            }
        }
        else {
            console.error('Missing login or password')
            return response(400, 'Missing login or password')
        }
    }
    catch (e) {
        console.error('Error while logging in: ', e)
        return response()
    }
}
