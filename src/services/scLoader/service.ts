import * as stream from 'stream';
import * as SyncPipes from "../../app/index";
import * as _ from 'lodash';
import {Configuration} from './Configuration'
import 'node-rest-client';
import 'events';

export class SocioCortexLoaderService extends SyncPipes.BaseService implements SyncPipes.ILoaderService {

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

    /**
     * ID of the workspace in SocioCortex
     */
    private workspaceId: string;


    private scTypes: any;

    /**
     * Counters for debug mode
     */
    private entityCounter = {
        value: 0,
        increase: () => {
            //print info every 50 entities saved
            if (this.entityCounter.value % 50 == 0) {
                this.logger.debug("Entities saved: " + this.entityCounter.value, null);
            }
            this.entityCounter.value++;
        },
        reset: () => {
            this.entityCounter.value = 0;
        }
    };

    private attributesCounter = {
        value: 0,
        increase: () => {
            //print info every 50 entity attributes saved
            if (this.attributesCounter.value % 50 == 0) {
                this.logger.debug("Entity attributes saved: " + this.attributesCounter.value, null);
            }
            this.attributesCounter.value++;
        },
        reset: () => {
            this.attributesCounter.value = 0;
        }
    };

    constructor() {
        super();
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
        this.scTypes = [];
        this.setConfiguration(config.config);
        return new Promise<any>((resolve) => {
            this.getToken().then(() => {
                resolve(this.updateSchema());
            });
        });
    }

    private updateSchema(): Promise<SyncPipes.ISchema> {
        return new Promise<SyncPipes.ISchema>((resolve, reject) => {
            this.fetchTypes().then((types) => {
                for (let i = 0; i < types.length; i++) {
                    this.schema.toObject().properties[types[i].name] = this.generateProperties(types[i]);
                }
                resolve(this.schema);
            });
        });
    }

    private generateProperties(type: any): any {
        let properties = {};
        properties["id"] = {"type": "string", "value": type.id};
        properties["name"] = {"type": "string", "value": type.name};
        properties["href"] = {"type": "string", "value": this.config.url + "/entityTypes/" + type.id};
        this.scTypes.push({"name": type.name, "id": type.id});
        for (let attribute of type.attributeDefinitions) {
            switch (attribute.attributeType) {
                case "Number":
                    properties[attribute.name] = {"type": "number"};
                    break;
                case "Link":
                    if (attribute.options.entityType != undefined && attribute.options.entityType.name != undefined) {
                        properties[attribute.name] = {
                            "type": "array", "items": {
                                "type": "object", "properties": {
                                    id: {
                                        type: "string",
                                        entityType: {
                                            name: attribute.options.entityType.name,
                                            id: attribute.options.entityType.id
                                        }
                                    }
                                }, "required": ["id"]
                            }
                        };
                        break;
                    }
                default:
                    if (attribute.name != "id") properties[attribute.name] = {"type": "string"};
            }
        }
        return {"type": "array", "items": {"type": "object", "properties": properties, "required": ["id", "name"]}};
    }

    private fetchTypes(): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this.handleRequests(this.config.url + "/workspaces").then((workspaces) => {
                //search for workspace id
                for (let workspace of workspaces) {
                    if (workspace.name.toLowerCase() == this.config.workspace.toLowerCase()) {
                        this.workspaceId = workspace.id;
                        this.handleRequests(this.config.url + "/workspaces/" + workspace.id + "/entityTypes").then((types) => {
                            let funcs = [];
                            let typesList = [];
                            for (let type of types) {
                                funcs.push(new Promise<any>((resolve) => {
                                    this.handleRequests(this.config.url + "/entityTypes/" + type.id).then((data) => {
                                        type.attributeDefinitions = data.attributeDefinitions;
                                        typesList.push(type);
                                        resolve();
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

    handleRequests(url: string): Promise<any> {
        return new Promise<any>((resolve) => {
            this.client.get(url, this.args, (data) => {
                resolve(data);
            }).end();
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
        this.entityCounter.reset();
        this.attributesCounter.reset();
        this.scTypes = [];

        return new Promise<any>((resolve) => {
            this.getToken().then(() => {
                this.updateSchema().then((schema) => {
                    this.schema = schema;
                    resolve(schema);
                });
            });
        });
    }

    private getToken(): Promise<any> {
        return new Promise<any>((resolve) => {
            let Client = require('node-rest-client').Client;
            this.client = new Client({user: this.config.username, password: this.config.password});
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

    private createEntitiesForType(entities, type): Promise<any> {
        if (entities.length < 1) {
            return Promise.resolve();
        }

        let insertEntity = (entity) => {
            if (!entity) {
                this.logger.debug("Entities have been created for type: " + type, null);
                return Promise.resolve();
            }
            return this.createEntity(entity, type).then(() => {
                return insertEntity(entities.pop());
            });
        };

        return insertEntity(entities.pop());
    }

    private createEntities(chunk): Promise<any> {
        return new Promise<any>((resolve) => {
            let promises = [];
            for (let type in chunk) {
                if(chunk.hasOwnProperty(type)) {
                    let entities = chunk[type].slice(0);
                    promises.push(this.createEntitiesForType(entities, type));
                }
            }
            Promise.all(promises).then(() => {
                this.logger.debug("Entities have been created", null);
                resolve();
            });
        });
    }

    private updateEntitiesForType(chunk, entities, type): Promise<any> {
        if (entities.length < 1) {
            return Promise.resolve();
        }

        let updateEntity = (entity) => {
            if (!entity) {
                this.logger.debug("Entities have been updated for type: " + type, null);
                return Promise.resolve();
            }
            return this.uploadAttributes(entity, chunk, type, entity.scId).then(() => {
                return updateEntity(entities.pop());
            });
        };

        return updateEntity(entities.pop());
    }

    private updateEntities(chunk): Promise<any> {
        return new Promise<any>((resolve) => {
            let p = [];
            for(let type in chunk) {
                if(chunk.hasOwnProperty(type)) {
                    let entities = chunk[type].slice(0);
                    p.push(this.updateEntitiesForType(chunk, entities, type));
                }
            }
            Promise.all(p).then(() => {
                this.logger.debug("Entities have been updated", null);
                resolve();
            });
        });
    }

    load(): stream.Writable {
        this.stream = new stream.Writable({objectMode: true});
        this.stream._write = (chunk, encoding, callback) => {
            this.logger.debug("Data loading started", null);
            this.createEntities(chunk).then(() => {
                this.updateEntities(chunk).then(() => {this.logger.debug("Data loading finished", null);});
            }).catch((err) => {
                this.logger.error(err);
                callback(err);
            });
        };

        return this.stream;
    }

    private uploadAttributes(attributes: any, chunk: any, type: string, id: string): Promise<any> {
        return new Promise<any>((resolve) => {
            this.handleRequests(this.config.url + "/entities/" + id + "/attributes").then((entityAttributes) => {
                let promises = [];
                _.forEach(attributes, (value: any, key: string) => {
                    let attribute = <any>_.find(entityAttributes, (attribute: any) => {
                        return attribute.name == key;
                    });
                    if (attribute == null) return;
                    //check if link
                    if (_.has(this.schema.toObject().properties[type].items.properties[key], "items.properties.id.entityType")) {
                        let entityType = this.schema.toObject().properties[type].items.properties[key].items.properties.id.entityType;
                        //get linked object
                        let link = <any>_.find(chunk[entityType.name], {id: value});
                        //check if it's already uploaded to sc
                        if (!_.has(link, "scId")) {
                            this.logger.debug("entity doesn't exists", JSON.stringify(link));
                            return;
                        }
                        //save attribute
                        let args = {
                            data: { values: [ { id: link.scId } ] },
                            headers: this.args.headers
                        };
                        promises.push(new Promise<any>((resolve) => {
                            this.handlePutRequests(this.config.url + "/attributes/" + attribute.id, args).then((data) => {
                                this.attributesCounter.increase();
                                resolve(data.id);
                            });
                        }));
                    } else {
                        let args = {
                            data: { values: [value] },
                            headers: this.args.headers
                        };
                        promises.push(new Promise<any>((resolve) => {
                            this.handlePutRequests(this.config.url + "/attributes/" + attribute.id, args).then((data) => {
                                this.attributesCounter.increase();
                                resolve(data.id);
                            });
                        }));
                    }
                });
                Promise.all(promises).then(() => {
                    resolve(true);
                });
            });
        });
    }

    private updateSCIdIfEntityExists(entity: any, type: string): Promise<any> {
        return new Promise<any>((resolve) => {
            //check if entity exists
            let promises = [];
            for(let i=0; i<this.scTypes.length; i++) {
                let scType = this.scTypes[i];
                if(scType.name.toLowerCase() === type.toLowerCase()) {
                    promises.push(new Promise<any>((resolve) => {
                        this.handleGetRequests(this.config.url + "/entityTypes/" + scType.id + "/entities").then(data => {
                            for(let j=0; j<data.length; j++) {
                                let e = data[j];
                                if(e.name.toLowerCase() === entity.name.toLowerCase()) {
                                    entity.scId = e.id;
                                    this.logger.debug("entity already exists: " + e.id);
                                }
                            }
                            resolve();
                        })
                    }));
                }
            }
            Promise.all(promises).then(() => {
                resolve();
            });
        });
    }

    private createEntity(entity: any, type: string): Promise<any> {
        return new Promise<any>((resolve) => {
            this.updateSCIdIfEntityExists(entity, type).then(() => {
                if (!_.has(entity, "scId")) {
                    let args = {
                        data: {
                            "name": entity.name,
                            "workspace": {
                                "id": this.workspaceId
                            },
                            "entityType": {
                                "id": this.schema.toObject().properties[type].items.properties.id.value
                            }
                        },
                        headers: this.args.headers
                    };

                    this.handlePostRequests(this.config.url + "/entities", args).then((data: any) => {
                        entity.scId = data.id;
                        this.entityCounter.increase();
                        resolve(data.id);
                    }).catch(() => {
                        resolve();
                    });
                } else {
                    resolve(entity.scId);
                }
            });
        })
    }

    /*
    getUniqueId(url): string {
        if (url != null) {
            var params = url.split("&");
            for (var i = 0; i < params.length; i++) {
                var keyValuePair = params[i].split("=");
                if (keyValuePair[0] === "contactId")
                    return keyValuePair[1];
            }
        }
        return null;
    }
    */

    handleGetRequests(url: string): Promise<any> {
        return new Promise<any>((resolve) => {
            let Client = require('node-rest-client').Client;
            let client = new Client({user: this.config.username, password: this.config.password});
            client.get(url, (data) => {
                resolve(data);
            }).on('error', (e) => {
                this.logger.error(e);
            }).end();
        });
    }


    handlePostRequests(url, args): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            let Client = require('node-rest-client').Client;
            let client = new Client({user: this.config.username, password: this.config.password});
            client.post(url, args, (data) => {
                resolve(data);
            }).on('requestTimeout', () => {
                this.logger.error('request has expired');
                reject();
            }).on('responseTimeout', () => {
                this.logger.error('response has expired');
                reject();
            }).on('error', (e) => {
                this.logger.error(e);
                reject();
            }).end();
        });
    }

    handlePutRequests(url, args): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this.client.registerMethod("putMethod", url, "PUT");
            this.client.methods.putMethod(args, (data) => {
                resolve(data);
            }).on('requestTimeout', () => {
                this.logger.error('request has expired');
                reject();
            }).on('responseTimeout', () => {
                this.logger.error('response has expired');
                reject();
            }).on('error', (e) => {
                this.logger.error(e);
                reject();
            }).end();
        });
    }
}
