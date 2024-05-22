import {APIGatewayEvent} from "aws-lambda";
import {getReportFromS3, getReportsFromDynamo} from "./Utils/DatabaseUtils";
import {checkIfTokenMatchesGivenID} from "./Utils/UserUtils";
import {response} from "./Constants/response";

exports.handler = async(event: APIGatewayEvent) => {
    try {
        if (event.httpMethod === 'OPTIONS') {
            return response(200, '')
        }

        const requesterID = event.pathParameters?.requesterID
        const reportID = event.queryStringParameters?.reportID

        if(!requesterID){
            console.error('requesterID not provided in path parameters')
            return response(400, 'requesterID not provided in path parameters')
        }
        if(!reportID){
            console.error('reportID not provided in path parameters')
            return response(400, 'reportID not provided in path parameters')
        }

        const auth = event.headers?.Authorization || ''

        const authMatchesUserID = await checkIfTokenMatchesGivenID(requesterID, auth)

        if('error' in authMatchesUserID){
            console.error('Token does not match creatorID')
            return response(403, 'Token does not match creatorID')
        }

        const getReport = await getReportFromS3(requesterID, reportID)

        if('error' in getReport){
            console.error('Error in createReport: ' + getReport.error)
            console.error('Request: ', JSON.stringify(event.body, null, 2))
            return response(getReport.code, getReport.error)
        }

        return response(200, getReport)

    }
    catch (e) {
        console.error('Error: ', e)
        console.error('Request: ', JSON.stringify(event.body, null, 2))
        return response()
    }
}