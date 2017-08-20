import { IServiceConfiguration, ISchema, Schema } from "../../app/index";
/**
 * Jira Configuration for this extension
 */
export class Configuration implements IServiceConfiguration {

    private _url: string;

    private _username: string;

    get url(): string {
        return this._url;
    }

    get username(): string {
        return this._username;
    }

    getSchema(): ISchema {
        return Schema.createFromObject({
            "$schema": "http://json-schema.org/draft-054/schema#",
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "Url"
                },
                "username": {
                    "type": "string",
                    "description": "Jira username",
                }
            },
            "additionalProperties": false,
            "required": [
                "url",
                "username"
            ]
        });
    }

    store(): Object {
        return {
            "url": this._url,
            "username": this._username
        };
    }

    load({url, username, token, project}): void {
        this._url = url;
        this._username = username;
    }
}