import {IUser} from "./IUser";
import {ICognitoUser} from "./ICognitoUser";

export interface IRegisterUser extends IUser, ICognitoUser {}