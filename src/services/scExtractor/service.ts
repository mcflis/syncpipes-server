import * as stream from 'stream';
import * as SyncPipes from "./../../app/index";
import 'node-rest-client';
//noinspection TypeScriptCheckImport
import * as sleep from 'sleep';

// config
import { Configuration } from './Configuration'
import {resolve} from "url";

/**
 * Extracts Repositories and Issues from a github org
 */
export class SocioCortexTypesExtractorService implements SyncPipes.IExtractorService {

    /**
     * Extractor configuration
     */
    private config: Configuration;

    /**
     * Execution context
     */
    private context: SyncPipes.IPipelineContext;

    private mapping: SyncPipes.IMapping;

    private client: any;

    /**
     * Output stream
     */
    private stream: stream.Readable;

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

    private types: any;

    /**
     * Data is fetched actively
     *
     * @return {ExtractorServiceType}
     */
    getType(): SyncPipes.ExtractorServiceType {
        return SyncPipes.ExtractorServiceType.Active;
    }

    prepare(context: SyncPipes.IPipelineContext, logger: SyncPipes.ILogger): Promise<any> {
        this.context = context;
        this.config = new Configuration();
        this.logger = logger;
        this.config.load(context.pipeline.extractorConfig.config);

        var Client = require('node-rest-client').Client;
        this.client = new Client({ user: this.config.username, password: this.config.password });
        this.logger.debug("Preparation done!");

        return Promise.resolve();
    }

    extract(): stream.Readable {
        // create output stream
        this.stream = new stream.Readable({objectMode: true});
        this.stream._read = () => {};

        this.mapping = this.context.pipeline.mapping;

        var attributesToExtract = {};
        for(var i = 0; i < this.mapping.groups.length; i++) {
            let group = this.mapping.groups[i];
            if(group.properties.length > 0) {
                for (var j = 0; j < group.properties.length; j++) {
                    if (attributesToExtract.hasOwnProperty(group.properties[j].fromPath.split("/")[0])) {
                        attributesToExtract[group.properties[j].fromPath.split("/")[0]].push(group.properties[j].fromPath.split("/")[1]);
                    } else {
                        attributesToExtract[group.properties[j].fromPath.split("/")[0]] = [];
                        attributesToExtract[group.properties[j].fromPath.split("/")[0]].push(group.properties[j].fromPath.split("/")[1]);
                    }

                }
            }
        }

        this.getTypeIdByName(this.mapping.groups[0].properties[0].fromPath.split("/")[0]).then((typeId) => {
            this.extractEntities(typeId, attributesToExtract);
        });

        return this.stream;
    }

    getTypeToExtract(group) {
        if(group.properties.length > 0) {
            return group.properties[0].fromPath.split("/")[0];
        } else {
            return null;
        }
    }

    getName(): string {
        return 'SocioCortexExtractor';
    }

    getConfiguration(): SyncPipes.IServiceConfiguration {
        return new Configuration();
    }

    setConfiguration(config: SyncPipes.IServiceConfiguration): void {
        this.config = <Configuration> config;
    }

    /**
     * Return the schema which can be extracted
     *
     * @return {Schema}
     */
    getSchema(): SyncPipes.ISchema {
        return this.schema;
    }

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
                       properties[types[i].attributeDefinitions[j].name] = {"type": "string", "href": types[i].attributeDefinitions[j].href};
                   }
                   var required = ["id", "name"];
                   this.schema.toObject().properties[types[i].name] = {"type": "array", "properties": properties, "required": required};
               }
               resolve(this.schema);
           });
        });
    }

    /**
     * Fetch all Types
     *
     * @param next
     */
    fetchTypes() : Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this.handleRequests(this.config.url + "/workspaces").then((workspaces) => {
                for(var w=0; w<workspaces.length; w++) {
                    if(workspaces[w].name.toLowerCase() === this.config.workspace.toLowerCase()) {
                        this.handleRequests(this.config.url + "/workspaces/" + workspaces[w].id + "/entityTypes").then((types) => {
                            var p = [];
                            var allTypes = [];
                            for(var i = 0; i < types.length; i++) {
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

    getTypeIdByName(typeName: string) : Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this.handleRequests(this.config.url + "/workspaces").then((workspaces) => {
                for(var w=0; w<workspaces.length; w++) {
                    if(workspaces[w].name.toLowerCase() === this.config.workspace.toLowerCase()) {
                        this.handleRequests(this.config.url + "/workspaces/" + workspaces[w].id + "/entityTypes").then((types) => {
                            for(var i = 0; i < types.length; i++) {
                                if(types[i].name === typeName) {
                                    resolve(types[i].id);
                                }
                            }
                        });
                    }
                }
            });
        });
    }

    public extractEntities(typeId, attributesToExtract) {
        this.logger.debug("Extract entities of type: " + this.config.url + "/entityTypes/" + typeId + "/entities");
        this.handleRequests(this.config.url + "/entityTypes/" + typeId + "/entities").then((entities) => {
            var allEntities = [];
            this.logger.debug("Entities to extract: " + entities.length);
            let getEntity = (refEntity) => {
                if (!refEntity) {
                    this.stream.push({"Kontakt": allEntities});
                    this.stream.push(null);
                    return;
                }

                this.handleRequests(refEntity.href).then((entity) => {
                    this.logger.debug("Extracting: " + entity.name);
                    var newEntity = {};
                    newEntity["id"] = entity.id;
                    newEntity["name"] = entity.name;
                    newEntity["href"] = entity.href;
                    for (var key in attributesToExtract) {
                        if (attributesToExtract.hasOwnProperty(key)) {
                            for (var j = 0; j < attributesToExtract[key].length; j++) {
                                if (attributesToExtract[key][j] != "id" && attributesToExtract[key][j] != "name" && attributesToExtract[key][j] != "href")
                                    newEntity[attributesToExtract[key][j]] = this.getAttributeValue(attributesToExtract[key][j], entity);
                            }
                        }
                    }
                    allEntities.push(newEntity);
                    getEntity(entities.pop());
                })
            };

            entities = [entities[0]];

            getEntity(entities.pop());

        });
    }

    getAttributeValue(attributeName, entity) {
        if(entity != null && entity.attributes != null) {
            for (var i = 0; i < entity.attributes.length; i++) {
                var attr = entity.attributes[i];
                if (attr.name === attributeName) {
                    if (attr.values.length == 1) {
                        return attr.values[0];
                    } else if (attr.values.length > 1) {
                        return attr.values;
                    }
                }
            }
        }
        return null;
    }

    handleRequests(url: string) : Promise<any> {
        return new Promise<any>((resolve, reject) => {
            var args = {
                requestConfig: { timeout: 20000 },
                responseConfig: { timeout: 20000 }
            };

             var req = this.client.get(url, args, (data, response) => {
                resolve(data);
            });

            req.on('requestTimeout', function (req) {
                this.logger.error('request has expired');
                req.abort();
                reject();
            });

            req.on('responseTimeout', function (res) {
                this.logger.error('response has expired');
                reject();
            });

            //it's usefull to handle request errors to avoid, for example, socket hang up errors on request timeouts
            req.on('error', function (err) {
                this.logger.error('request error');
                this.logger.error(err.message);
                this.logger.error(err.response);
                reject();
            });

        });
    }

    updateConfigSchema(inputData:Array<Buffer>) { return null; }
}
