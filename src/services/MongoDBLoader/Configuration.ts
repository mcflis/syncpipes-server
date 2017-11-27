import { IServiceConfiguration, ISchema, Schema } from "../../app/index";
/**
 * MongoDB Configuration for this extension
 */
export class Configuration implements IServiceConfiguration {

    private _mongoUrl: string;

    get mongoUrl(): string {
        return this._mongoUrl;
    }

    getSchema(): ISchema {
        return Schema.createFromObject({
            "$schema": "http://json-schema.org/draft-04/schema#",
            "type": "object",
            "properties": {
                "mongoUrl": {
                    "type": "string",
                    "description": "mongoUrl",
                    "default": "mongodb://guest:guest@localhost:27017/amelie?authSource=amelie&authMechanism=SCRAM-SHA-1"
                }
            },
            "additionalProperties": false,
            "required": [
                "mongoUrl"
            ]
        });
    }

    store(): Object {
        return {
            "mongoUrl": this._mongoUrl
        };
    }

    load({mongoUrl}): void {
        this._mongoUrl = mongoUrl;
    }
}
