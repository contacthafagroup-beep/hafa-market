import ApiCall from "./ApiCall";
export interface SchemaChangeStatus {
    collection: string;
    validated_docs: number;
    altered_docs: number;
}
export default class Operations {
    private apiCall;
    constructor(apiCall: ApiCall);
    perform(operationName: "vote" | "snapshot" | "cache/clear" | (string & {}), queryParameters?: Record<string, any>): Promise<any>;
    getSchemaChanges(): Promise<SchemaChangeStatus[]>;
}
