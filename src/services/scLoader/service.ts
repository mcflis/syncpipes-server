import * as stream from 'stream';
import * as SyncPipes from "../../app/index";
import * as path from 'path';
import { readFileSync } from 'fs';
// config
import { Configuration } from './Configuration'
import 'node-rest-client';
import forEachChild = ts.forEachChild;

/**
 * Load Contacts to Exchange
 */
export class SocioCortexLoaderService implements SyncPipes.ILoaderService {

    /**
     * Extension config
     */
    private config: Configuration;

    /**
     * Node Rest Client
     */
    private client: any;
    private args: any;

    /**
     * Workflow context
     */
    private context: SyncPipes.IPipelineContext;

    /**
     * Stream provided to the framework
     */
    private stream: stream.Writable;

    /**
     * SyncPipes logger instance
     */
    private logger: SyncPipes.ILogger;

    /**
     * Extension schema
     */
    private schema: SyncPipes.ISchema;

    constructor() {
        this.schema = SyncPipes.Schema.createFromFile(__dirname + '/schema.json');
    }

    /**
     * Returns the name of the extension
     *
     * @return {string}
     */
    getName(): string {
        return 'SocioCortexLoader';
    }

    /**
     * Returns the schema of the configuration
     *
     * @return {SyncPipes.ISchema}
     */
    getSchema(): SyncPipes.ISchema {
        return this.schema;
    }

    /**
     * Returns the configured schema
     *
     * @param config
     * @returns {Promise<SyncPipes.ISchema>}
     */
    getConfigSchema(config): Promise<SyncPipes.ISchema> {
        this.setConfiguration(config.config);
        return new Promise<any> ((resolve) => {
            this.getToken().then(() => {
                resolve(this.updateSchema());
            });
        });
    }

    private updateSchema(): Promise<SyncPipes.ISchema> {
        return new Promise<SyncPipes.ISchema>((resolve, reject) => {
            this.fetchTypes().then((types) => {
                for(let i = 0; i < types.length; i++) {
                    this.schema.toObject().properties[types[i].name] = this.generateProperties(types[i].attributeDefinitions)
                }
                resolve(this.schema);
            });
        });
    }

    private generateProperties(attributeDefinitions: any): any {
        let properties = {};
        properties["id"] = {"type": "string"};
        properties["name"] = {"type": "string"};
        properties["href"] = {"type": "string"};
        for(let attribute of attributeDefinitions) {
            switch (attribute.attributeType) {
                case "Number":
                    properties[attribute.name] = {"type":"number"};
                    break;
                case "Link":
                    if(attribute.options.entityType != undefined && attribute.options.entityType.attributeDefinitions != undefined) {
                        properties[attribute.name] = this.generateProperties(attribute.options.entityType.attributeDefinitions);
                        break;
                    }
                default:
                    properties[attribute.name] = {"type":"string"};
            }
        }
        let required = ["id", "name"];
        return {"type": "array", "items":{"type": "object", "properties":properties, "required": required}};
    }

    private fetchTypes() : Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this.handleRequests(this.config.url + "/workspaces").then((workspaces) => {
                //search for workspace id
                for(let workspace of workspaces) {
                    if(workspace.name.toLowerCase() == this.config.workspace.toLowerCase()) {
                        this.handleRequests(this.config.url + "/workspaces/"+workspace.id+"/entityTypes").then((types) => {
                            let funcs = [];
                            let typesList = [];
                            for(let type of types) {
                                    funcs.push(new Promise<any> ((resolve) => {
                                        this.handleRequests(type.href).then((data) => {
                                            for (let attribute of data.attributeDefinitions) {
                                                if(attribute.options != undefined && attribute.options.entityType != undefined) {
                                                    this.handleRequests(attribute.options.entityType.href).then((answer) => {
                                                        attribute.options.entityType.attributeDefinitions = answer.attributeDefinitions;
                                                        type.attributeDefinitions = data.attributeDefinitions;
                                                        typesList.push(type);
                                                        resolve();
                                                    });
                                                }
                                            }
                                        });

                                    }));
                            }
                            Promise.all(funcs).then(() => {
                                resolve(typesList);
                            });
                        });
                    }
                }
            });
        });
    }

    handleRequests(url: string) : Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this.client.get(url, (data, response) => {
                resolve(data);
            });
        });
    }


    /**
     * TBD
     * @return {Configuration}
     */
    getConfiguration(): SyncPipes.IServiceConfiguration {
        return new Configuration();
    }

    setConfiguration(config: SyncPipes.IServiceConfiguration): void {
        this.config = <Configuration>config;
    }

    /**
     * Connect to mysql and setup database before loading
     *
     * @param context
     * @param logger
     * @return {Promise<any>}
     */
    prepare(context: SyncPipes.IPipelineContext, logger: SyncPipes.ILogger): Promise<any> {
        this.context = context;
        this.logger = logger;
        return new Promise<any> ((resolve) => {
            this.getToken().then(() => {
                this.updateSchema().then( (schema) => {
                    this.schema = schema;
                    resolve(schema);
                });
            });
        });
    }


    private getToken() : Promise<any> {
        return new Promise<any> ((resolve,reject) => {
            let Client = require('node-rest-client').Client;
            this.client = new Client({ user: this.config.username, password: this.config.password });
            this.handleRequests(this.config.url + "/jwt").then((answer) => {
                this.args = {
                    headers: {
                        "Authorization": "Bearer " + answer.token
                    }
                };
                resolve();
            });
        });

    }


    load(): stream.Writable {

        this.stream = new stream.Writable({objectMode: true});
        this.stream._write = (entities, encoding, callback) => {
            Object.keys(entities).forEach(function(key) {
                var val = entities[key];

                for (var i=0; i<val.length; i++){
                    console.log(val[i]);
                }

            });
            //console.log(`Chunk: ${JSON.stringify(entities, null, "  ")}`);

            //for(var i=0; i<chunk.length; i++) {
            //    console.log(chunk[i]);
            //}
//
//
//                var itemId = this.getUniqueId(entities[i].url);
//                var args = {
//                    data: entities[i],
//                    headers: { "Content-Type": "application/json" }
//                };
//
//                if(itemId != null)
//                    entities[i].uniqueId = itemId;
///*
//                this.handlePostRequests(this.contactsUrl, args).then((response) => {
//                    if(response != null) {
//                        // create new contact
//                        console.log(response);
//                    } else {
//                        // log error
//                    }
//                });
//*/

            callback();
        };

        return this.stream;
    }

    getUniqueId(url): string {
        if(url != null) {
            var params = url.split("&");
            for (var i = 0; i < params.length; i++) {
                var keyValuePair = params[i].split("=");
                if (keyValuePair[0] === "contactId")
                    return keyValuePair[1];
            }
        }
        return null;
    }

    handleGetRequests(url: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this.client.get(url, (data, response) => {
                resolve(data);
            });
        });
    }

    handlePostRequests(url, args) : Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this.client.post(url, args, (data, response) => {
                resolve(data);
            });
        });
    }
}
