import { IServiceConfiguration, ISchema, Schema } from "../../app/index";
/**
 * Jira Configuration for this extension
 */
export class Configuration implements IServiceConfiguration {

    private _url: string;

    private _username: string;

    private _password: string;

    get url(): string {
        return this._url;
    }

    get username(): string {
        return this._username;
    }

    get password(): string {
        return this._password;
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
                },
                "password": {
                    "type": "string",
                    "description": "Jira password",
                }
            },
            "additionalProperties": false,
            "required": [
                "url",
                "username",
                "password"
            ]
        });
    }

    store(): Object {
        return {
            "url": this._url,
            "username": this._username,
            "password": this._password
        };
    }

    load({url, username, password}): void {
        this._url = url;
        this._username = username;
        this._password = password
    }
}