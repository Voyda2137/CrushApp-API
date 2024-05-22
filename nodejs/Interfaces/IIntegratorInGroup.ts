import {Integrator} from "./IIntegrator";

export interface IIntegratorInGroup extends Integrator {
    isDeletedFromGroup?: boolean
}