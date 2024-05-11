import {ICognitoUserAttribute} from "./ICognitoUserAttribute";

export interface ICognitoUser {
    userPoolId?: string;
    username: string;
    password?: string;
    userAttributes?: ICognitoUserAttribute[];
}