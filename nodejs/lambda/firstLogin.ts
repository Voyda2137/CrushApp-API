import {respondToNewPwdCognitoChallenge} from "./Utils/DatabaseUtils";
import {APIGatewayEvent} from "aws-lambda";
import {response} from "./Constants/response";

exports.handler = async (event: APIGatewayEvent) => {
    try {
        const username = event.pathParameters?.userID
        const { password, session } = JSON.parse(event.body || '')

        if(password && username && session){
            const authChallengeResponse = await respondToNewPwdCognitoChallenge(password, username, session)

            if('error' in authChallengeResponse) {
                console.error('Error in authentication challenge: ', JSON.stringify(authChallengeResponse.error, null, 2))
                return response(authChallengeResponse.code, authChallengeResponse.error)
            }
            return response(200, {
                userID: authChallengeResponse.sub,
                id_token: authChallengeResponse.id_token,
                access_token: authChallengeResponse.access_token
            })
        }
        else {
            console.error('No password, username or session')
            return response(400, 'No password, username or session')
        }
    }
    catch (e) {
        console.error('Error: ', e)
        return response()
    }
}
