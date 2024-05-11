import {ICognitoUserAttribute} from "./ICognitoUserAttribute"

export interface IUser{
    PK?: string
    role: {
        isService: boolean
        isManager: boolean
    }
    workers?: string[]
    manager?: string
    cognitoAttributes: ICognitoUserAttribute[]
}
