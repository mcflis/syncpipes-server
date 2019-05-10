import * as stream from 'stream';
import * as SyncPipes from "../../app/index";
// config
import { Configuration } from './Configuration'
import 'node-rest-client';

/**
 * Load Contacts to Exchange
 */
export class OutlookContactsLoaderService extends SyncPipes.BaseService implements SyncPipes.ILoaderService {

    /**
     * Extension config
     */
    private config: Configuration;

    /**
     * Node Rest Client
     */
    private client: any;


    private scClient: any;

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
        super();
        this.schema = SyncPipes.Schema.createFromFile(__dirname + '/schema.json');
    }

    /**
     * Returns the name of the extension
     *
     * @return {string}
     */
    getName(): string {
        return 'OutlookContactsLoader';
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
    getConfigSchema(config ): Promise<SyncPipes.ISchema> {
        return new Promise<SyncPipes.ISchema>((resolve, reject) => {
            resolve(this.schema);
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
        this.contactsUrl = this.config.serviceUrl + "api/contacts";
        var Client = require('node-rest-client').Client;
        this.client = new Client();

        var SCClient = require('node-rest-client').Client;
        this.scClient = new Client({ user: context.pipeline.extractorConfig.config.username, password: context.pipeline.extractorConfig.config.password });

        return this.setConfig().then(() => {
            return Promise.resolve();
        });
    }


    load(): stream.Writable {
        this.stream = new stream.Writable({objectMode: true});
        this.stream._write = (entities, encoding, callback) => {

            let loadEntity = (refEntity) => {
                if (!refEntity) {
                    callback();
                    return;
                }

                let itemId = this.getUniqueId(refEntity.url);
                if(itemId != null)
                    refEntity.uniqueId = itemId;

                let args = {
                    data: refEntity,
                    headers: { "Content-Type": "application/json" }
                };

                this.handlePostRequests(this.contactsUrl, args).then((response) => {
                    if(response != null && response.status === 200) {
                        // create new contact
                        this.updateSCEntity(response).then((updatedEntity) => {
                            this.logger.debug("Entity saved: " + updatedEntity.id);
                            loadEntity(entities.pop());
                        });
                    } else {
                        this.logger.error("Entity was not saved: " + refEntity.id);
                        // log error
                    }
                });
            };

            loadEntity(entities.pop());
        };

        return this.stream;
    }

    updateSCEntity(response) {
        return new Promise<any>((resolve, reject) => {
            let scEntityUrl = "https://wwwmatthes.in.tum.de/api/v1/entities/" + response.id;
            this.handleSCGetRequests(scEntityUrl).then((entity) => {
                for (let i = 0; i < entity.attributes.length; i++) {
                    let attribute = entity.attributes[i];
                    if (attribute.name === "Url") {
                        attribute.values = [];
                        attribute.values.push(response.url);
                        break;
                    }
                }
                var args = {
                    data: entity,
                    headers: { "Content-Type": "application/json" }
                };
                this.handlePutRequests(scEntityUrl, args).then((updatedEntity) =>{
                   resolve(updatedEntity);
                });
            });
        });
    }

    setConfig(): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            var args = {
                data: this.config,
                headers: { "Content-Type": "application/json" }
            };

            this.handlePostRequests(this.config.serviceUrl + "api/config", args).then((response) => {
                resolve(response);
            });
        });
    }

    getUniqueId(url): string {
        if(url != null) {
            var params = url.split("&");
            for (var i = 0; i < params.length; i++) {
                if(params[i].indexOf("contactid") > -1) {
                    return params[i].replace("contactid=", "");
                }
            }
        }
        return null;
    }

    handleSCGetRequests(url: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this.scClient.get(url, (data, response) => {
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

    handlePutRequests(url, args) : Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this.scClient.put(url, args, (data, response) => {
                resolve(data);
            });
        });
    }
}
