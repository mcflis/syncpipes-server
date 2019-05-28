import { IServiceConfiguration, ISchema, Schema } from "../../app/index";
/**
 * MySQL Configuration for this extension
 */
interface StoredConfiguration {
    host: string;
    port: number;
    pathPrefix: string;
    username: string;
    password: string;
    project: string;
    lastUpdated: string;
}

export class Configuration implements IServiceConfiguration {

    private _host: string;

    private _port: number;

    private _pathPrefix: string;

    private _username: string;

    private _password: string;

    private _project: string;

    private _lastUpdated: string;


    get host(): string {
        return this._host;
    }

    get port(): number {
        return this._port;
    }

    get pathPrefix(): string {
        return this._pathPrefix;
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
                "host": {
                    "type": "string",
                    "description": "Host"
                },
                "port": {
                    "type": "integer",
                    "description": "Port"
                },
                "pathPrefix": {
                    "type": "string",
                    "description": "Path prefix pointing to Jira Document Root"
                },
                "username": {
                    "type": "string",
                    "description": "Jira username",
                },
                "password": {
                    "type": "string",
                    "description": "Jira password or Target set in auth proxy",
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
                "host",
                "username",
                "project"
            ]
        });
    }

    store(): StoredConfiguration {
        return {
            "host": this._host,
            "port": this._port,
            "pathPrefix": this._pathPrefix,
            "username": this._username,
            "password": this._password,
            "project": this._project,
            "lastUpdated": this._lastUpdated
        };
    }

    load({host, port, pathPrefix, username, password, project, lastUpdated}: StoredConfiguration): void {
        this._host = host;
        this._port = port;
        this._pathPrefix = pathPrefix;
        this._username = username;
        this._password = password;
        this._project = project;
        this._lastUpdated = lastUpdated;
    }
}
