import { IServiceConfiguration, ISchema, Schema } from "../../app/index";
/**
 * MySQL Configuration for this extension
 */
interface StoredConfiguration {
    url: string;
    username: string;
    password: string;
    project: string;
    lastUpdated: string;
}

export class Configuration implements IServiceConfiguration {

    private _url: string;

    private _username: string;

    private _password: string;

    private _project: string;

    private _lastUpdated: string;

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

    get lastUpdated(): string {
        return this._lastUpdated;
    }

    getSchema(): ISchema {
        return Schema.createFromObject({
            "$schema": "http://json-schema.org/draft-04/schema#",
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
                },
                "project": {
                    "type": "string",
                    "description": "Jira project",
                },
                "lastUpdated": {
                    "type": "string",
                    "description": "Timestamp supported by the 'updated' field in Jira"
                }
            },
            "additionalProperties": false,
            "required": [
                "url",
                "username",
                "password",
                "project",
            ]
        });
    }

    store(): StoredConfiguration {
        return {
            "url": this._url,
            "username": this._username,
            "password": this._password,
            "project": this._project,
            "lastUpdated": this._lastUpdated
        };
    }

    load({url, username, password, project, lastUpdated}: StoredConfiguration): void {
        this._url = url;
        this._username = username;
        this._password = password;
        this._project = project;
        this._lastUpdated = lastUpdated
    }
}
