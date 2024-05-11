import {IReportData} from "./IReportData";

export interface IDynamoReport {
    PK: string // user PK
    SK: string // report
    data: IReportData[]
}