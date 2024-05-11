import {defaultHeaders} from "./defaultHeaders";

export const tokenNotMatchingUserID = {
    statusCode: 403,
    headers: defaultHeaders,
    body: JSON.stringify({ message: 'Unauthorized' }),
}