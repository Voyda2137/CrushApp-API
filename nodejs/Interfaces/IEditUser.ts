import {ICognitoUserAttribute} from "./ICognitoUserAttribute"

export interface IEditUser {
    isDeleted?: boolean,
    cognitoAttributes?: ICognitoUserAttribute[]
}