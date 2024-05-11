import {APIGatewayEvent} from "aws-lambda";
import {getReportsFromDynamo} from "./Utils/DatabaseUtils";
import {checkIfTokenMatchesGivenID} from "./Utils/UserUtils";
import {response} from "./Constants/response";

exports.handler = async(event: APIGatewayEvent) => {
    try {
        if (event.httpMethod === 'OPTIONS') {
            return response(200, '')
        }

        const requesterID = event.pathParameters?.requesterID

        if(!requesterID){
            console.error('requesterID not provided in path parameters')
            return response(400, 'requesterID not provided in path parameters')
        }

        const auth = event.headers?.Authorization || ''

        const authMatchesUserID = await checkIfTokenMatchesGivenID(requesterID, auth)

        if('error' in authMatchesUserID){
            console.error('Token does not match creatorID')
            return response(403, 'Token does not match creatorID')
        }

        const getReports = await getReportsFromDynamo(requesterID)

        if('error' in getReports){
            console.error('Error in createReport: ' + getReports.error)
            return response(getReports.code, getReports.error)
        }

        return response(200, getReports)

    }
    catch (e) {
        console.error('Error: ', e)
        return response()
    }
}