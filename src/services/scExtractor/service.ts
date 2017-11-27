import * as stream from 'stream';
import * as SyncPipes from "./../../app/index";
import 'node-rest-client';

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

        let Client = require('node-rest-client').Client;
        this.client = new Client({ user: this.config.username, password: this.config.password });
        this.logger.debug("Preparation done");

        return Promise.resolve();
    }

    extract(): stream.Readable {
        // create output stream
        this.logger.debug("Starting the extraction process");
        this.stream = new stream.Readable({objectMode: true});
        this.stream._read = () => {};
        this.customExtract();
        return this.stream;
    }

    customExtract(): void {
        this.mapping = this.context.pipeline.mapping;
        let p = [];
        let allP = [];
        let typeIds = [];
        let attributesTypeIdMap = {};
        for(let i=0; i<this.mapping.groups.length; i++) {
            let attributesToExtract = {};
            let group = this.mapping.groups[i];
            let fromGroupName = this.mapping.groups[i].properties[0].fromPath.split("/")[0];
            let toGroupName = this.mapping.groups[i].properties[0].toPath.split("/")[0];
            this.logger.debug("Extract entities for: " + toGroupName);
            if(group.properties.length > 0) {
                for (let j = 0; j < group.properties.length; j++) {
                    if (attributesToExtract.hasOwnProperty(group.properties[j].fromPath.split("/")[0])) {
                        attributesToExtract[group.properties[j].fromPath.split("/")[0]].push(group.properties[j].fromPath.split("/")[1]);
                    } else {
                        attributesToExtract[group.properties[j].fromPath.split("/")[0]] = [];
                        attributesToExtract[group.properties[j].fromPath.split("/")[0]].push(group.properties[j].fromPath.split("/")[1]);
                    }
                }
            }

            p.push(this.getTypeIdByName(fromGroupName).then((typeId) => {
                typeIds.push(typeId);
                attributesTypeIdMap[typeId] =  [attributesToExtract, fromGroupName];
            }));
        }
        Promise.all(p).then(() => {
            for(let j=0; j<typeIds.length; j++) {
                allP.push(this.extractEntities(attributesTypeIdMap[typeIds[j]][1], typeIds[j], attributesTypeIdMap[typeIds[j]][0]));
            }
            Promise.all(allP).then(() => {
                this.stream.push(null);
            });
        });
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
        let Client = require('node-rest-client').Client;
        this.client = new Client({ user: this.config.username, password: this.config.password });
        return this.updateSchema();
    }

    updateSchema(): Promise<SyncPipes.ISchema> {
        return new Promise<SyncPipes.ISchema>((resolve, reject) => {
           this.fetchTypes().then((types) => {
               for(let i = 0; i < types.length; i++) {
                   let properties = {};
                   properties["id"] = {"type": "string", "default": types[i].id};
                   properties["name"] = {"type": "string"};
                   properties["href"] = {"type": "string"};
                   for(let j=0; j<types[i].attributeDefinitions.length; j++) {
                       properties[types[i].attributeDefinitions[j].name] = {"type": "string", "href": types[i].attributeDefinitions[j].href};
                   }
                   let required = ["id", "name"];
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
                for(let w=0; w<workspaces.length; w++) {
                    if(workspaces[w].name.toLowerCase() === this.config.workspace.toLowerCase()) {
                        this.handleRequests(this.config.url + "/workspaces/" + workspaces[w].id + "/entityTypes").then((types) => {
                            let p = [];
                            let allTypes = [];
                            for(let i = 0; i < types.length; i++) {
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
                for(let w=0; w<workspaces.length; w++) {
                    if(workspaces[w].name.toLowerCase() === this.config.workspace.toLowerCase()) {
                        this.handleRequests(this.config.url + "/workspaces/" + workspaces[w].id + "/entityTypes").then((types) => {
                            for(let i = 0; i < types.length; i++) {
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

    extractEntities(groupName, typeId, attributesToExtract): Promise<any> {
        return new Promise<any>((resolve) => {
            this.logger.debug("Extract entities of type: " + this.config.url + "/entityTypes/" + typeId + "/entities");
            this.handleRequests(this.config.url + "/entityTypes/" + typeId + "/entities").then((entities) => {
                let streamIn = {};
                streamIn[groupName] = [];
                this.logger.debug("Entities to extract: " + entities.length);
                let getEntity = (refEntity) => {
                    if (!refEntity) {
                        this.stream.push(streamIn);
                        return resolve();
                    }

                    this.handleRequests(refEntity.href).then((entity) => {
                        this.logger.debug("Extracting: " + entity.name);
                        let newEntity = {};
                        newEntity["id"] = entity.id;
                        newEntity["name"] = entity.name;
                        newEntity["href"] = entity.href;
                        for(let key in attributesToExtract) {
                            if(attributesToExtract.hasOwnProperty(key)) {
                                for(let j = 0; j < attributesToExtract[key].length; j++) {
                                    if(attributesToExtract[key][j] != "id" && attributesToExtract[key][j] != "name" && attributesToExtract[key][j] != "href")
                                        newEntity[attributesToExtract[key][j]] = this.getAttributeValue(attributesToExtract[key][j], entity);
                                }
                            }
                        }
                        streamIn[groupName].push(newEntity);
                        getEntity(entities.pop());
                    });
                };
                getEntity(entities.pop());
            });
        });
    }

    getAttributeValue(attributeName, entity) {
        if(entity != null && entity.attributes != null) {
            for (let i = 0; i < entity.attributes.length; i++) {
                let attr = entity.attributes[i];
                if (attr.name === attributeName) {
                    if(attr.values.length == 1 && attr.values[0].hasOwnProperty("name")) {
                        return attr.values[0].name;
                    } else if (attr.values.length == 1) {
                        return attr.values[0];
                    } else if (attr.values.length > 1) {
                        let arrayOfValues = [];
                        for(let k=0; k<attr.values.length; k++) {
                            arrayOfValues.push(attr.values[k].name);
                        }
                        return arrayOfValues;
                        //return attr.values;
                    }
                }
            }
        }
        return null;
    }

    handleRequests(url: string) : Promise<any> {
        return new Promise<any>((resolve, reject) => {
            let args = {
                requestConfig: { timeout: 20000 },
                responseConfig: { timeout: 20000 }
            };

             let req = this.client.get(url, args, (data, response) => {
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
