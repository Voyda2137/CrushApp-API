import {defaultHeaders} from "./defaultHeaders";

export const response = (code: number = 500, message?: any, headers?: object) => {
    if(headers) headers = {...defaultHeaders, ...headers}
    else headers = defaultHeaders

    if(code !== 500){
        if(code === 200){
            return {
                statusCode: 200,
                headers: headers,
                body: JSON.stringify(message, null, 2)
            }
        }
        return {
            statusCode: code,
            headers: headers,
            body: JSON.stringify({message: message}, null, 2)
        }
    }
    return {
        statusCode: 500,
        headers: headers,
        body: JSON.stringify({message: 'Internal server error' })
    }
}