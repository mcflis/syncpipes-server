import * as stream from 'stream';
import * as SyncPipes from "../../app/index";
import * as path from 'path';
import { readFileSync } from 'fs';
// config
import { Configuration } from './Configuration'
import 'node-rest-client';

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

    private contactsUrl: string;

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
        var Client = require('node-rest-client').Client;
        this.client = new Client({ user: this.config.username, password: this.config.password });
        return this.updateSchema();


    }

    updateSchema(): Promise<SyncPipes.ISchema> {
        return new Promise<SyncPipes.ISchema>((resolve, reject) => {
            this.fetchTypes().then((types) => {
                for(var i = 0; i < types.length; i++) {
                    var properties = {};
                    properties["id"] = {"type": "string", "default": types[i].id};
                    properties["name"] = {"type": "string"};
                    properties["href"] = {"type": "string"};
                    for(var j=0; j<types[i].attributeDefinitions.length; j++) {
                        //TODO: JSON Schema generation has to be improved according to standard
                        switch (types[i].attributeDefinitions[j].attributeType) {
                            case "Number":
                                properties[types[i].attributeDefinitions[j].name] = {"type": "number"};
                                break;
                            case "Link":
                                // attribute definitions can contain references to system types like Pages
                                // (then entityType is undefined)
                                // or to the custom types (then entityType is an object, that contains: id, name, href )
                                if (types[i].attributeDefinitions[j].options["entityType"] == undefined) {
                                    properties[types[i].attributeDefinitions[j].name] = {"type": "string"};
                                }
                                else {
                                    properties[types[i].attributeDefinitions[j].name] = {"type": "string", "href": types[i].attributeDefinitions[j].options.entityType.name };
                                }
                                break;
                            case "Text":
                                properties[types[i].attributeDefinitions[j].name] = {"type": "string"};
                                break;
                            case "Date":
                                properties[types[i].attributeDefinitions[j].name] = {"type": "string"};
                                break;
                            default:
                                properties[types[i].attributeDefinitions[j].name] = {"type": "string"};
                        }
                    }
                    var required = ["id", "name"];
                    this.schema.toObject().properties[types[i].name.toString()] = {"type": "array", "items":{"type": "object", "properties":properties, "required": required}};
                }
                resolve(this.schema);
            });
        });
    }

    private fetchTypes() : Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this.handleRequests(this.config.url + "/workspaces").then((workspaces) => {
                for (var w = 0; w < workspaces.length; w++) {
                    if (workspaces[w].name.toLowerCase() === this.config.workspace.toLowerCase()) {
                        this.handleRequests(this.config.url + "/workspaces/" + workspaces[w].id + "/entityTypes").then((types) => {
                            var p = [];
                            var allTypes = [];
                            for (var i = 0; i < types.length; i++) {
                                p.push(this.handleRequests(types[i].href).then((type) => {
                                    allTypes.push(type);
                                }));
                            }

                            Promise.all(p).then(() => {
                                resolve(allTypes);
                            }).catch((err) => {
                                this.logger.error(err);
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
        this.contactsUrl = this.config.url + "api/contacts";
        var Client = require('node-rest-client').Client;
        this.client = new Client();
        return this.updateSchema().then( (schema) => {
            this.schema = schema;
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
