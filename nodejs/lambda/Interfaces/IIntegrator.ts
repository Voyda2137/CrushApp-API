import {IntegratorStatus} from "../Enums/IntegratorStatus";

export interface Integrator {
    PK?: string
    location?: string
    serialNumber?: string
    status?: IntegratorStatus
}
