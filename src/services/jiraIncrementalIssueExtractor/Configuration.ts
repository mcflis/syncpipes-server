import { IServiceConfiguration, ISchema, Schema } from "../../app";
/**
 * MySQL Configuration for this extension
 */
interface StoredConfiguration {
    url: string;
    username: string;
    password: string;
    project: string;
    backoffInMs: number;
}

export class Configuration implements IServiceConfiguration {

    private _url: string;

    private _username: string;

    private _password: string;

    private _project: string;

    private _backoffInMs: number;

    constructor() {
        this._backoffInMs = 5000;
    }



    get url(): string {
        return this._url;
    }

    get username(): string {
        return this._username;
    }

    get password(): string {
        return this._password;
    }

    get project(): string {
        return this._project;
    }

    get backoffInMs(): number {
        return this._backoffInMs;
    }

    getSchema(): ISchema {
        return Schema.createFromObject({
            "$schema": "http://json-schema.org/draft-04/schema#",
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "Jira Host or Auth Proxy Host (must be full WHATWG Url https://url.spec.whatwg.org/)"
                },
                "username": {
                    "type": "string",
                    "description": "Jira username",
                },
                "password": {
                    "type": "string",
                    "description": "Jira password",
                },
                "project": {
                    "type": "string",
                    "description": "Jira project",
                },
                "backoffInMs": {
                    "type": "integer",
                    "description": "Time in milliseconds between requests to Jira",
                    "default": this.backoffInMs
                }
            },
            "additionalProperties": false,
            "required": [
                "url",
            ]
        });
    }

    store(): StoredConfiguration {
        return {
            "url": this._url,
            "username": this._username,
            "password": this._password,
            "project": this._project,
            "backoffInMs": this._backoffInMs
        };
    }

    load({url, username, password, project, backoffInMs}: StoredConfiguration): void {
        this._url = url;
        this._username = username;
        this._password = password;
        this._project = project;
        this._backoffInMs = backoffInMs;
    }
}
