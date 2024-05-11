import {IDecodedToken} from "../Interfaces/IDecodedToken";
import {IFunctionError} from "../Interfaces/IFunctionError";
import {jwtDecode} from "jwt-decode";
import {IFunctionSuccess} from "../Interfaces/IFunctionSuccess";

export const checkIfTokenMatchesGivenID = async (userID: string, token: string): Promise<IFunctionSuccess | IFunctionError> => {
    try {

        console.log('auth token: ' + token)

        const tokenWithoutBearer = token.substring(7)
        const decodedToken = jwtDecode(tokenWithoutBearer) as IDecodedToken

        if(decodedToken && userID === decodedToken.sub){
            return {success: 'userID matches sub'}
        }
        console.log("token: " + decodedToken)
        console.log("userID: " + userID)
        return {error: 'Token does not match userID', code: 403}
    }
    catch (e) {
        console.error('Error decoding id_token: ', e)
        return {error: 'Error decoding id_token: ' + e, code: 500}
    }
}