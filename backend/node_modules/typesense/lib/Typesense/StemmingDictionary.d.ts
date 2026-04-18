import ApiCall from "./ApiCall";
export interface StemmingDictionaryCreateSchema {
    root: string;
    word: string;
}
export interface StemmingDictionarySchema {
    id: string;
    words: StemmingDictionaryCreateSchema[];
}
export interface StemmingDictionaryDeleteSchema {
    id: string;
}
export default class StemmingDictionary {
    private id;
    private apiCall;
    constructor(id: string, apiCall: ApiCall);
    retrieve(): Promise<StemmingDictionarySchema>;
    delete(): Promise<StemmingDictionaryDeleteSchema>;
    private endpointPath;
}
