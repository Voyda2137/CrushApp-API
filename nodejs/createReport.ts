import {APIGatewayEvent} from "aws-lambda";
import {createReportForDateRange} from "./Utils/DatabaseUtils";
import {checkIfTokenMatchesGivenID} from "./Utils/UserUtils";
import {response} from "./Constants/response";

exports.handler = async(event: APIGatewayEvent) => {
    try {
        const requesterID = event.pathParameters?.requesterID
        const userID = event.queryStringParameters?.managerID || requesterID || ''

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

        const { reportName, data } = JSON.parse(event.body || '')

        const createReport = await createReportForDateRange(requesterID, userID, reportName, data)

        if('error' in createReport){
            console.error('Error in createReport: ' + createReport.error)
            return response(createReport.code, createReport.error)
        }

        return response(200, createReport)

    }
    catch (e) {
        console.error('Error: ', e)
        return response()
    }
}