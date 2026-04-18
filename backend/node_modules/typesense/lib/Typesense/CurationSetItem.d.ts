import ApiCall from "./ApiCall";
import type { CurationObjectSchema } from "./CurationSets";
export interface CurationItemDeleteResponseSchema {
    id: string;
}
export default class CurationSetItem {
    private name;
    private itemId;
    private apiCall;
    constructor(name: string, itemId: string, apiCall: ApiCall);
    retrieve(): Promise<CurationObjectSchema>;
    upsert(params: CurationObjectSchema): Promise<CurationObjectSchema>;
    delete(): Promise<CurationItemDeleteResponseSchema>;
    private endpointPath;
}
