import {CognitoAttributes} from "../Enums/CognitoAttributes";

export interface ICognitoUserAttribute {
    Name: CognitoAttributes;
    Value: string;
}
