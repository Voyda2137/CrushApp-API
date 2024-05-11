import { Integrator } from "./IIntegrator"

export interface IEditIntegrator extends Integrator{
    isDeleted: boolean,
}